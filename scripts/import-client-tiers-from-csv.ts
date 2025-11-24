/**
 * Import Client Tiers from CSV
 * 
 * This script imports client tier assignments from "Data/New - BH/New - BH - TIER CLIENTI.csv"
 * into the clients table, updating the tier_id field.
 * 
 * CSV Structure:
 * - Columns: TOP, TIER 1, TIER 2, 20 IQ, EXTRA
 * - Each row contains client names in the format "Nome Cognome" or "Nome"
 * - Names are matched against existing clients in the database by name and surname
 * 
 * Usage:
 * 1. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables
 * 2. Ensure CSV file is in the Data/New - BH/ directory
 * 3. Run: npx tsx scripts/import-client-tiers-from-csv.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

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

// Data directory path
const DATA_DIR = path.join(process.cwd(), 'Data');

// Tier name mapping from CSV column names to database tier names
const TIER_MAPPING: { [key: string]: string | null } = {
  'TOP': 'TOP',
  'TIER 1': 'Tier 1',
  'TIER 2': 'Tier 2',
  '20 IQ': '20IQ',
  'EXTRA': null // EXTRA column is not a tier, skip it
};

// Helper function to normalize name for matching
function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

// Helper function to find client by name and surname
async function findClientByName(name: string, surname: string | null): Promise<string | null> {
  // Try exact match first
  let query = supabase
    .from('clients')
    .select('id, name, surname')
    .ilike('name', name.trim());
  
  if (surname) {
    query = query.ilike('surname', surname.trim());
  } else {
    query = query.is('surname', null);
  }
  
  const { data, error } = await query.limit(1).maybeSingle();
  
  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
    console.error(`Error finding client ${name} ${surname || ''}:`, error);
    return null;
  }
  
  if (data) {
    return data.id;
  }
  
  // Try fuzzy match: check if name matches without surname
  if (surname) {
    const { data: fuzzyData } = await supabase
      .from('clients')
      .select('id, name, surname')
      .ilike('name', name.trim())
      .limit(5);
    
    if (fuzzyData && fuzzyData.length > 0) {
      // Check if any client has a surname that contains the provided surname
      const match = fuzzyData.find(c => 
        c.surname && normalizeName(c.surname).includes(normalizeName(surname))
      );
      if (match) {
        return match.id;
      }
      
      // If only one match and surname is null in DB, use it
      if (fuzzyData.length === 1 && !fuzzyData[0].surname) {
        return fuzzyData[0].id;
      }
    }
  }
  
  return null;
}

// Main import function
async function importClientTiers(): Promise<void> {
  console.log('\n📊 Importing client tiers from CSV...\n');
  
  // Step 1: Load tiers from database
  console.log('📋 Step 1: Loading tiers from database...');
  const { data: tiers, error: tiersError } = await supabase
    .from('tiers')
    .select('id, name');
  
  if (tiersError) {
    console.error('Error loading tiers:', tiersError);
    process.exit(1);
  }
  
  const tierMap = new Map<string, string>();
  for (const tier of tiers || []) {
    tierMap.set(tier.name, tier.id);
  }
  
  console.log(`  ✓ Loaded ${tierMap.size} tiers`);
  for (const [name, id] of tierMap.entries()) {
    console.log(`    - ${name}: ${id}`);
  }
  
  // Step 2: Read CSV file
  console.log('\n📄 Step 2: Reading CSV file...');
  const csvPath = path.join(DATA_DIR, 'New - BH', 'New - BH - TIER CLIENTI.csv');
  
  if (!fs.existsSync(csvPath)) {
    console.error(`  ❌ File not found: ${csvPath}`);
    process.exit(1);
  }
  
  const content = fs.readFileSync(csvPath, 'utf-8');
  const contentWithoutBOM = content.charCodeAt(0) === 0xFEFF ? content.slice(1) : content;
  
  // Parse CSV with headers
  const records = parse(contentWithoutBOM, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
    bom: true
  });
  
  if (records.length === 0) {
    console.error('  ❌ No data rows found in CSV');
    process.exit(1);
  }
  
  console.log(`  ✓ Parsed ${records.length} rows from CSV`);
  
  // Step 3: Process records
  console.log('\n🔄 Step 3: Processing records...');
  
  let totalProcessed = 0;
  let totalUpdated = 0;
  let totalNotFound = 0;
  const notFoundClients: Array<{ name: string; surname: string | null; tier: string }> = [];
  
  // Process each tier column
  for (const [csvColumnName, dbTierName] of Object.entries(TIER_MAPPING)) {
    if (!dbTierName) continue; // Skip EXTRA column
    
    const tierId = tierMap.get(dbTierName);
    if (!tierId) {
      console.log(`  ⚠ Tier "${dbTierName}" not found in database, skipping column "${csvColumnName}"`);
      continue;
    }
    
    console.log(`\n  Processing tier: ${dbTierName} (column: ${csvColumnName})...`);
    let tierCount = 0;
    let tierUpdated = 0;
    let tierNotFound = 0;
    
    // Process each row in this tier column
    for (const record of records) {
      const clientNameRaw = record[csvColumnName];
      if (!clientNameRaw || clientNameRaw.trim() === '') continue;
      
      // Parse name and surname
      const nameParts = clientNameRaw.trim().split(/\s+/);
      const name = nameParts[0] || '';
      const surname = nameParts.slice(1).join(' ') || null;
      
      if (!name) continue;
      
      tierCount++;
      totalProcessed++;
      
      // Find client in database
      const clientId = await findClientByName(name, surname);
      
      if (!clientId) {
        tierNotFound++;
        totalNotFound++;
        notFoundClients.push({ name, surname, tier: dbTierName });
        console.log(`    ⚠ Client not found: ${name} ${surname || ''}`);
        continue;
      }
      
      // Update client tier
      const { error: updateError } = await supabase
        .from('clients')
        .update({ tier_id: tierId })
        .eq('id', clientId);
      
      if (updateError) {
        console.error(`    ❌ Error updating tier for ${name} ${surname || ''}:`, updateError);
      } else {
        tierUpdated++;
        totalUpdated++;
      }
    }
    
    console.log(`    ✓ Processed: ${tierCount}, Updated: ${tierUpdated}, Not found: ${tierNotFound}`);
  }
  
  // Step 4: Summary
  console.log('\n📊 Step 4: Summary...');
  console.log(`  ✓ Total clients processed: ${totalProcessed}`);
  console.log(`  ✓ Successfully updated: ${totalUpdated}`);
  console.log(`  ⚠ Not found: ${totalNotFound}`);
  
  if (notFoundClients.length > 0) {
    console.log('\n  ⚠ Clients not found in database:');
    for (const client of notFoundClients.slice(0, 20)) { // Show first 20
      console.log(`    - ${client.name} ${client.surname || ''} (Tier: ${client.tier})`);
    }
    if (notFoundClients.length > 20) {
      console.log(`    ... and ${notFoundClients.length - 20} more`);
    }
  }
  
  // Step 5: Verify import
  console.log('\n✅ Step 5: Verifying import...');
  const { data: clientsWithTiers, error: verifyError } = await supabase
    .from('clients')
    .select('id, name, surname, tier_id, tiers(name)')
    .not('tier_id', 'is', null);
  
  if (verifyError) {
    console.error('  ❌ Error verifying import:', verifyError);
  } else {
    const tierDistribution = new Map<string, number>();
    for (const client of clientsWithTiers || []) {
      const tierName = (client.tiers as any)?.name || 'Unknown';
      tierDistribution.set(tierName, (tierDistribution.get(tierName) || 0) + 1);
    }
    
    console.log(`  ✓ Total clients with tier assigned: ${clientsWithTiers?.length || 0}`);
    console.log('  ✓ Tier distribution:');
    for (const [tierName, count] of Array.from(tierDistribution.entries()).sort()) {
      console.log(`    - ${tierName}: ${count}`);
    }
  }
}

// Run import
if (require.main === module) {
  importClientTiers()
    .then(() => {
      console.log('\n🎉 Script completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

export { importClientTiers };



