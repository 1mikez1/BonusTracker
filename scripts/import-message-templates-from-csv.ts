/**
 * Import Message Templates from CSV
 * 
 * This script imports message templates from "Data/Guide app - Guide.csv"
 * into the message_templates table.
 * 
 * Usage:
 * 1. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables
 * 2. Ensure CSV file is in the Data/ directory
 * 3. Run: npx tsx scripts/import-message-templates-from-csv.ts
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

// Helper function to normalize app names
function normalizeAppName(name: string): string {
  const normalized = name.trim().toUpperCase();
  
  // Map common variations to standard names
  const nameMap: { [key: string]: string } = {
    'TRADE': 'TRADEREPUBLIC',
    'TRADEREPUBLIC': 'TRADEREPUBLIC',
    'TRADING 212': 'TRADING212',
    'BUDDY': 'BUDDYBANK',
    'BUDDY BANK': 'BUDDYBANK',
    'BYBIT EU': 'BYBIT',
    'DEBLOCK': 'DEBLOCK',
    'TINABA': 'TINABA',
    'TRAD212': 'TRADING212'
  };
  
  return nameMap[normalized] || normalized;
}

// Main import function
async function importMessageTemplates(): Promise<void> {
  console.log('\n📧 Importing message templates from CSV...\n');
  
  // Step 1: Get all apps from database to build appMap
  console.log('📋 Step 1: Loading apps from database...');
  const { data: apps, error: appsError } = await supabase
    .from('apps')
    .select('id, name');
  
  if (appsError) {
    console.error('Error loading apps:', appsError);
    process.exit(1);
  }
  
  const appMap = new Map<string, string>();
  for (const app of apps || []) {
    const normalizedName = normalizeAppName(app.name);
    // Store both the exact name and normalized name
    appMap.set(app.name.toUpperCase(), app.id);
    appMap.set(normalizedName, app.id);
  }
  
  console.log(`  ✓ Loaded ${appMap.size / 2} apps (with normalized names)`);
  
  // Step 2: Read CSV file
  console.log('\n📄 Step 2: Reading CSV file...');
  const csvPath = path.join(DATA_DIR, 'Guide app - Guide.csv');
  
  if (!fs.existsSync(csvPath)) {
    console.error(`  ❌ File not found: ${csvPath}`);
    process.exit(1);
  }
  
  const content = fs.readFileSync(csvPath, 'utf-8');
  const contentWithoutBOM = content.charCodeAt(0) === 0xFEFF ? content.slice(1) : content;
  
  // Parse without headers - get raw arrays
  const records = parse(contentWithoutBOM, {
    columns: false, // No headers - return as arrays
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
    bom: true,
    skip_records_with_error: true
  });
  
  if (records.length === 0) {
    console.error('  ❌ No data rows found in CSV');
    process.exit(1);
  }
  
  console.log(`  ✓ Parsed ${records.length} rows from CSV`);
  
  // Step 3: Process records
  console.log('\n🔄 Step 3: Processing records...');
  
  let count = 0;
  let skipped = 0;
  let currentApp: string | null = null;
  let currentAppId: string | null = null;
  let stepOrderMap: Map<string, number> = new Map(); // Track step order per app: "appId" -> nextOrder
  let lastAppKey: string | null = null; // Track when app changes to reset order
  
  // Process each row - each row is an array [app, step, content]
  for (const record of records) {
    if (!Array.isArray(record) || record.length < 2) {
      continue;
    }
    
    // Column 1: App name (if present, it's a new app; if empty, use previous app)
    // Column 2: Step name
    // Column 3: Content (may be empty if content spans multiple rows)
    const appNameRaw = (record[0] || '').toString().trim();
    const stepName = (record[1] || '').toString().trim() || null;
    let content = (record[2] || '').toString().trim();
    
    // Update current app if column 1 has a value
    if (appNameRaw && appNameRaw !== '') {
      currentApp = appNameRaw;
      const normalizedAppName = normalizeAppName(appNameRaw);
      
      // Special handling for "Onboard" - it's a generic template, not app-specific
      if (normalizedAppName === 'ONBOARD' || appNameRaw.toLowerCase() === 'onboard') {
        currentAppId = null;
        currentApp = 'Onboard'; // Ensure consistent naming
      } else {
        // Try to find app by normalized name
        currentAppId = appMap.get(normalizedAppName) || appMap.get(appNameRaw.toUpperCase()) || null;
        
        // If not found, try partial match
        if (!currentAppId) {
          for (const [appName, appId] of appMap.entries()) {
            if (normalizedAppName.includes(appName) || appName.includes(normalizedAppName)) {
              currentAppId = appId;
              break;
            }
          }
        }
        
        // If still not found, log warning
        if (!currentAppId) {
          console.log(`  ⚠ App not found for "${appNameRaw}" (normalized: "${normalizedAppName}")`);
        }
      }
      
      // Reset step order when app changes
      const newAppKey = currentAppId || 'onboard';
      if (newAppKey !== lastAppKey) {
        // New app - reset order counter
        stepOrderMap.set(newAppKey, 1);
        lastAppKey = newAppKey;
      }
    }
    
    // Skip if no step name (invalid row)
    if (!stepName) {
      continue;
    }
    
    // Skip if content is too short (likely empty or invalid)
    if (!content || content.length < 5) {
      skipped++;
      continue;
    }
    
    // Filter out templates that have "Other" as step and contain Onboard content
    const contentLower = content.toLowerCase();
    const stepLower = stepName.toLowerCase();
    
    // Skip "Other" and "introduction" steps for all apps (these are usually misclassified)
    if ((stepName === 'Other' || stepLower === 'introduction' || stepLower === 'intro') && currentAppId) {
      skipped++;
      continue;
    }
    
    // Check if this is an Onboard template (generic, not app-specific)
    const isOnboardContent = (
      contentLower.includes('ciao, piacere') ||
      contentLower.includes('bonus di benvenuto') ||
      contentLower.includes('calendly.com/bonus-hunters') ||
      contentLower.includes('spiegazione + registrazione modulo') ||
      contentLower.includes('prenotazione fup')
    );
    
    const isOnboardStep = (
      stepLower.includes('spiegazione') ||
      stepLower.includes('registrazione modulo') ||
      stepLower.includes('prenotazione fup')
    );
    
    // If it's Onboard content, ensure it's not assigned to a specific app
    if (isOnboardContent || isOnboardStep) {
      if (currentAppId && currentApp && currentApp.toLowerCase() !== 'onboard') {
        // Force it to be Onboard (app_id = null)
        currentAppId = null;
        currentApp = 'Onboard';
      }
    }
    
    // Clean up content - remove extra quotes if present
    content = content.replace(/^"""/g, '"').replace(/"""$/g, '"').replace(/^"/g, '').replace(/"$/g, '');
    
    // Determine step order: increment for each new step within the same app
    const appKey = currentAppId || 'onboard'; // Use 'onboard' as key for generic templates
    
    // Get current order for this app and increment
    const currentOrder = stepOrderMap.get(appKey) || 1;
    const stepOrder = currentOrder;
    
    // Increment for next step in this app
    stepOrderMap.set(appKey, currentOrder + 1);
    
    // Create template name: combine app + step (or just step for Onboard)
    let templateName: string;
    if (currentAppId === null || (currentApp && currentApp.toLowerCase() === 'onboard')) {
      // Onboard templates: use just the step name
      templateName = stepName;
    } else if (currentApp) {
      // App-specific templates: use "App - Step"
      templateName = `${currentApp} - ${stepName}`;
    } else {
      // Fallback: just step name
      templateName = stepName;
    }
    
    // Check if template already exists (by name and app_id combination)
    let existingQuery = supabase
      .from('message_templates')
      .select('id')
      .eq('name', templateName);
    
    if (currentAppId === null) {
      existingQuery = existingQuery.is('app_id', null);
    } else {
      existingQuery = existingQuery.eq('app_id', currentAppId);
    }
    
    const { data: existing } = await existingQuery.maybeSingle();

    if (existing) {
      // Update existing template with latest data
      const { error } = await supabase
        .from('message_templates')
        .update({
          app_id: currentAppId,
          content: content.trim(),
          language: 'it',
          step: stepName,
          step_order: stepOrder
        })
        .eq('id', existing.id);
      
      if (!error) {
        count++;
      } else {
        console.error(`  ❌ Error updating template ${templateName}:`, error);
      }
    } else {
      // Insert new template
      const { error } = await supabase
        .from('message_templates')
        .insert({
          name: templateName,
          app_id: currentAppId,
          content: content.trim(),
          language: 'it',
          step: stepName,
          step_order: stepOrder
        });

      if (error) {
        if (error.code === '23505') {
          // Duplicate key - this shouldn't happen with our check, but handle gracefully
          skipped++;
        } else {
          console.error(`  ❌ Error creating template ${templateName}:`, error);
        }
      } else {
        count++;
      }
    }
  }
  
  console.log(`\n✅ Import completed!`);
  console.log(`  ✓ Imported/Updated: ${count} templates`);
  console.log(`  ⚠ Skipped: ${skipped} rows`);
  
  // Step 4: Verify import
  console.log('\n📊 Step 4: Verifying import...');
  const { data: templates, error: verifyError } = await supabase
    .from('message_templates')
    .select('id, name, app_id, step, step_order')
    .order('app_id', { ascending: true, nullsFirst: true })
    .order('step_order', { ascending: true });
  
  if (verifyError) {
    console.error('  ❌ Error verifying import:', verifyError);
  } else {
    const onboardCount = templates?.filter(t => t.app_id === null).length || 0;
    const appSpecificCount = templates?.filter(t => t.app_id !== null).length || 0;
    console.log(`  ✓ Total templates: ${templates?.length || 0}`);
    console.log(`  ✓ Onboard templates: ${onboardCount}`);
    console.log(`  ✓ App-specific templates: ${appSpecificCount}`);
  }
}

// Run import
if (require.main === module) {
  importMessageTemplates()
    .then(() => {
      console.log('\n🎉 Script completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

export { importMessageTemplates };

