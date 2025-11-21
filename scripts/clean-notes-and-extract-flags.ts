/**
 * Clean Notes and Extract Flags
 * 
 * This script parses client notes to extract:
 * - InvitedBy: X (saves to invited_by_name)
 * - RISCRIVERE flag (saves to needs_rewrite = true)
 * - RISCRIVE flag (saves to rewritten = true)
 * 
 * Then removes these patterns from notes, keeping only clean content.
 * 
 * Usage:
 * 1. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables
 * 2. Run: npx tsx scripts/clean-notes-and-extract-flags.ts [--test] [--limit=N]
 * 
 * Options:
 *   --test: Test mode (dry run, no database updates)
 *   --limit=N: Process only N random records (default: 100 for test, all for production)
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Initialize Supabase client with service role key (bypasses RLS)
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Parse command line arguments
const args = process.argv.slice(2);
const isTestMode = args.includes('--test');
const limitArg = args.find(arg => arg.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1]) : (isTestMode ? 100 : null);

// Logging setup
const logDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logFile = path.join(logDir, `clean-notes-${new Date().toISOString().replace(/:/g, '-')}.log`);

function log(message: string, level: 'info' | 'warn' | 'error' = 'info') {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  console.log(logMessage);
  fs.appendFileSync(logFile, logMessage + '\n');
}

// Pattern matching functions
interface ParsedFlags {
  invitedByName: string | null;
  needsRewrite: boolean;
  rewritten: boolean;
  cleanedNotes: string | null;
}

function parseNotes(notes: string | null): ParsedFlags {
  if (!notes || notes.trim() === '') {
    return {
      invitedByName: null,
      needsRewrite: false,
      rewritten: false,
      cleanedNotes: null
    };
  }

  let cleanedNotes = notes;
  let invitedByName: string | null = null;
  let needsRewrite = false;
  let rewritten = false;

  // Pattern 1: InvitedBy: X (case-insensitive, various formats)
  const invitedByPatterns = [
    /InvitedBy:\s*([^\n|]+)/i,
    /InvitedBy\s*:\s*([^\n|]+)/i,
    /\[Flags\]\s*InvitedBy:\s*([^\n|]+)/i,
    /InvitedBy\s*=\s*([^\n|]+)/i
  ];

  for (const pattern of invitedByPatterns) {
    const match = cleanedNotes.match(pattern);
    if (match && match[1]) {
      invitedByName = match[1].trim();
      // Remove the pattern from notes
      cleanedNotes = cleanedNotes.replace(pattern, '').trim();
      break;
    }
  }

  // Pattern 2: RISCRIVERE flag (case-insensitive)
  const needsRewritePatterns = [
    /\bRISCRIVERE\b/i,
    /\[Flags\]\s*RISCRIVERE/i,
    /\|\s*RISCRIVERE\s*\|/i,
    /RISCRIVERE\s*\|/i,
    /\|\s*RISCRIVERE/i
  ];

  for (const pattern of needsRewritePatterns) {
    if (pattern.test(cleanedNotes)) {
      needsRewrite = true;
      // Remove the pattern from notes
      cleanedNotes = cleanedNotes.replace(pattern, '').trim();
    }
  }

  // Pattern 3: RISCRIVE flag (case-insensitive)
  const rewrittenPatterns = [
    /\bRISCRIVE\b/i,
    /\[Flags\]\s*RISCRIVE/i,
    /\|\s*RISCRIVE\s*\|/i,
    /RISCRIVE\s*\|/i,
    /\|\s*RISCRIVE/i
  ];

  for (const pattern of rewrittenPatterns) {
    if (pattern.test(cleanedNotes)) {
      rewritten = true;
      // Remove the pattern from notes
      cleanedNotes = cleanedNotes.replace(pattern, '').trim();
    }
  }

  // Clean up remaining separators and empty brackets/flags
  cleanedNotes = cleanedNotes
    .replace(/^\|\s*/, '') // Remove leading |
    .replace(/\s*\|$/, '') // Remove trailing |
    .replace(/\|\s*\|/g, '|') // Remove double |
    .replace(/\[Flags\]\s*/gi, '') // Remove [Flags] marker
    .replace(/^\s*-\s*/, '') // Remove leading dash
    .replace(/^\s*:\s*/, '') // Remove leading colon
    .trim();

  // If cleaned notes is empty or only contains separators, set to null
  if (!cleanedNotes || cleanedNotes.match(/^[\s|\-:]*$/)) {
    cleanedNotes = null;
  }

  return {
    invitedByName,
    needsRewrite,
    rewritten,
    cleanedNotes
  };
}

// Main processing function
async function processClients(): Promise<void> {
  log('🚀 Starting notes cleaning and flag extraction...');
  log(`   Mode: ${isTestMode ? 'TEST (dry run)' : 'PRODUCTION'}`);
  log(`   Limit: ${limit ? limit : 'ALL'}`);

  // Step 1: Fetch clients
  log('\n📋 Step 1: Fetching clients...');
  
  let query = supabase
    .from('clients')
    .select('id, name, surname, notes, invited_by_name, needs_rewrite, rewritten, rewrite_j')
    .not('notes', 'is', null);

  if (limit) {
    // For random sampling, we'll fetch all and sample in memory
    // (Supabase doesn't support random() directly in select)
    const { data: allClients, error: fetchError } = await query;
    
    if (fetchError) {
      log(`❌ Error fetching clients: ${fetchError.message}`, 'error');
      process.exit(1);
    }

    if (!allClients || allClients.length === 0) {
      log('⚠️  No clients with notes found');
      return;
    }

    // Random sample
    const shuffled = [...allClients].sort(() => 0.5 - Math.random());
    const clients = shuffled.slice(0, Math.min(limit, allClients.length));
    
    log(`   ✓ Fetched ${allClients.length} clients with notes`);
    log(`   ✓ Sampling ${clients.length} random clients`);
    
    await processBatch(clients);
  } else {
    // Process all clients
    const { data: clients, error: fetchError } = await query;
    
    if (fetchError) {
      log(`❌ Error fetching clients: ${fetchError.message}`, 'error');
      process.exit(1);
    }

    if (!clients || clients.length === 0) {
      log('⚠️  No clients with notes found');
      return;
    }

    log(`   ✓ Fetched ${clients.length} clients with notes`);
    await processBatch(clients);
  }
}

async function processBatch(clients: any[]): Promise<void> {
  log(`\n🔄 Step 2: Processing ${clients.length} clients...`);

  let processed = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  const stats = {
    invitedByNameExtracted: 0,
    needsRewriteSet: 0,
    rewrittenSet: 0,
    notesCleaned: 0,
    notesEmptied: 0
  };

  for (const client of clients) {
    try {
      processed++;

      // Parse notes
      const parsed = parseNotes(client.notes);

      // Check if any changes are needed
      const hasChanges = 
        parsed.invitedByName !== client.invited_by_name ||
        parsed.needsRewrite !== client.needs_rewrite ||
        parsed.rewritten !== client.rewritten ||
        parsed.cleanedNotes !== client.notes;

      if (!hasChanges) {
        skipped++;
        continue;
      }

      // Prepare update data
      const updateData: any = {};

      if (parsed.invitedByName !== client.invited_by_name) {
        updateData.invited_by_name = parsed.invitedByName;
        if (parsed.invitedByName) stats.invitedByNameExtracted++;
      }

      if (parsed.needsRewrite !== client.needs_rewrite) {
        updateData.needs_rewrite = parsed.needsRewrite;
        if (parsed.needsRewrite) stats.needsRewriteSet++;
      }

      // Check if rewritten field exists, otherwise use rewrite_j as fallback
      const hasRewrittenField = 'rewritten' in client;
      const currentRewritten = hasRewrittenField ? client.rewritten : client.rewrite_j;
      
      if (parsed.rewritten !== currentRewritten) {
        if (hasRewrittenField) {
          updateData.rewritten = parsed.rewritten;
        } else {
          // Fallback to rewrite_j if rewritten field doesn't exist yet
          updateData.rewrite_j = parsed.rewritten;
        }
        if (parsed.rewritten) stats.rewrittenSet++;
      }

      if (parsed.cleanedNotes !== client.notes) {
        updateData.notes = parsed.cleanedNotes;
        if (parsed.cleanedNotes === null) {
          stats.notesEmptied++;
        } else {
          stats.notesCleaned++;
        }
      }

      // Log changes
      log(`\n   Client: ${client.name} ${client.surname || ''} (${client.id})`);
      if (updateData.invited_by_name !== undefined) {
        log(`      InvitedBy: ${client.invited_by_name || 'null'} → ${updateData.invited_by_name || 'null'}`);
      }
      if (updateData.needs_rewrite !== undefined) {
        log(`      needs_rewrite: ${client.needs_rewrite} → ${updateData.needs_rewrite}`);
      }
      if (updateData.rewritten !== undefined || updateData.rewrite_j !== undefined) {
        const fieldName = updateData.rewritten !== undefined ? 'rewritten' : 'rewrite_j';
        const oldValue = 'rewritten' in client ? client.rewritten : client.rewrite_j;
        const newValue = updateData.rewritten !== undefined ? updateData.rewritten : updateData.rewrite_j;
        log(`      ${fieldName}: ${oldValue} → ${newValue}`);
      }
      if (updateData.notes !== undefined) {
        const oldPreview = (client.notes || '').substring(0, 50) + (client.notes && client.notes.length > 50 ? '...' : '');
        const newPreview = (updateData.notes || '').substring(0, 50) + (updateData.notes && updateData.notes.length > 50 ? '...' : '');
        log(`      notes: "${oldPreview}" → "${newPreview}"`);
      }

      // Update database (if not test mode)
      if (!isTestMode) {
        const { error: updateError } = await supabase
          .from('clients')
          .update(updateData)
          .eq('id', client.id);

        if (updateError) {
          log(`      ❌ Error updating: ${updateError.message}`, 'error');
          errors++;
          continue;
        }
      }

      updated++;
    } catch (error: any) {
      log(`   ❌ Error processing client ${client.id}: ${error.message}`, 'error');
      errors++;
    }
  }

  // Summary
  log('\n📊 Step 3: Summary...');
  log(`   ✓ Processed: ${processed}`);
  log(`   ✓ Updated: ${updated}`);
  log(`   ⚠ Skipped (no changes): ${skipped}`);
  log(`   ❌ Errors: ${errors}`);
  log('\n   📈 Extracted Flags:');
  log(`      - InvitedBy names: ${stats.invitedByNameExtracted}`);
  log(`      - needs_rewrite flags: ${stats.needsRewriteSet}`);
  log(`      - rewritten flags: ${stats.rewrittenSet}`);
  log(`      - Notes cleaned: ${stats.notesCleaned}`);
  log(`      - Notes emptied: ${stats.notesEmptied}`);

  if (isTestMode) {
    log('\n⚠️  TEST MODE: No database updates were made');
    log('   Run without --test flag to apply changes');
  }

  log(`\n📝 Full log saved to: ${logFile}`);
}

// Run script
if (require.main === module) {
  processClients()
    .then(() => {
      log('\n🎉 Script completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      log(`\n❌ Script failed: ${error.message}`, 'error');
      console.error(error);
      process.exit(1);
    });
}

export { parseNotes, processClients };

