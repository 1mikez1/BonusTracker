/**
 * Import Promotions with Advanced Profit System
 * 
 * This script imports promotions from CSV and populates the new advanced profit fields:
 * - base_profit_client
 * - base_profit_owner
 * - dynamic_profit_allowed
 * - detailed_conditions (JSONB)
 * 
 * Usage:
 * 1. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables
 * 2. Ensure CSV file is in the Data/New - BH/ directory
 * 3. Run: npx tsx scripts/import-promotions-with-advanced-profits.ts
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

// Helper function to parse numeric values
function parseNumeric(value: string | null | undefined): number | null {
  if (!value || value.trim() === '') return null;
  // Handle Italian format (comma as decimal separator)
  const cleaned = value.toString().replace(/\./g, '').replace(',', '.');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

// Helper function to parse boolean
function parseBoolean(value: string | null | undefined): boolean {
  if (!value) return false;
  const lower = value.toString().toLowerCase().trim();
  return lower === 'true' || lower === '1' || lower === 'si' || lower === 'yes';
}

// Helper function to parse JSONB conditions
function parseDetailedConditions(row: any): any | null {
  // Example conditions structure (customize based on your CSV)
  const conditions: any = {};

  // Tier-based multipliers (if present in CSV)
  if (row['Tier TOP Multiplier'] || row['Tier 1 Multiplier'] || row['Tier 2 Multiplier']) {
    conditions.tier_multipliers = {};
    if (row['Tier TOP Multiplier']) {
      conditions.tier_multipliers['TOP'] = parseNumeric(row['Tier TOP Multiplier']);
    }
    if (row['Tier 1 Multiplier']) {
      conditions.tier_multipliers['Tier 1'] = parseNumeric(row['Tier 1 Multiplier']);
    }
    if (row['Tier 2 Multiplier']) {
      conditions.tier_multipliers['Tier 2'] = parseNumeric(row['Tier 2 Multiplier']);
    }
  }

  // Volume-based conditions (if present)
  if (row['Volume Threshold'] || row['Volume Bonus']) {
    conditions.volume = {
      threshold: parseNumeric(row['Volume Threshold']),
      bonus: parseNumeric(row['Volume Bonus'])
    };
  }

  // Time-based conditions (if present)
  if (row['Early Bird Bonus'] || row['Early Bird Deadline']) {
    conditions.time_based = {
      early_bird_bonus: parseNumeric(row['Early Bird Bonus']),
      early_bird_deadline: row['Early Bird Deadline'] || null
    };
  }

  // Return null if no conditions
  return Object.keys(conditions).length > 0 ? conditions : null;
}

// Main import function
async function importPromotions(): Promise<void> {
  console.log('\n💰 Importing promotions with advanced profit system...\n');

  // Step 1: Load apps from database
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
    appMap.set(app.name.toUpperCase(), app.id);
    appMap.set(app.name, app.id);
  }

  console.log(`  ✓ Loaded ${appMap.size / 2} apps`);

  // Step 2: Read CSV file
  console.log('\n📄 Step 2: Reading CSV file...');
  const csvPath = path.join(DATA_DIR, 'New - BH', 'New - BH - Promozioni.csv');

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

  let count = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of records) {
    try {
      // Get app name (adjust column name based on your CSV)
      const appName = row['App'] || row['APP'] || row['Nome App'] || '';
      if (!appName || appName.trim() === '') {
        skipped++;
        continue;
      }

      const appId = appMap.get(appName.toUpperCase()) || appMap.get(appName);
      if (!appId) {
        console.log(`  ⚠ App not found: "${appName}"`);
        skipped++;
        continue;
      }

      // Get promotion name
      const promotionName = row['Nome'] || row['Promozione'] || row['Name'] || appName;

      // Parse profits
      const baseClientProfit = parseNumeric(row['Client Reward'] || row['Client'] || row['Cliente']) || 
                               parseNumeric(row['Base Client Profit']) || 0;
      const baseOwnerProfit = parseNumeric(row['Our Reward'] || row['Owner'] || row['Noi']) || 
                              parseNumeric(row['Base Owner Profit']) || 0;

      // Check if dynamic profits are allowed
      const dynamicAllowed = parseBoolean(row['Dynamic Profit'] || row['Profitto Dinamico'] || 
                                          row['Allow Override'] || 'false');

      // Parse detailed conditions
      const detailedConditions = parseDetailedConditions(row);

      // Check if promotion exists
      const { data: existing } = await supabase
        .from('promotions')
        .select('id')
        .eq('app_id', appId)
        .eq('name', promotionName)
        .maybeSingle();

      const promotionData: any = {
        app_id: appId,
        name: promotionName,
        base_profit_client: baseClientProfit,
        base_profit_owner: baseOwnerProfit,
        dynamic_profit_allowed: dynamicAllowed,
        detailed_conditions: detailedConditions,
        // Keep existing fields for backward compatibility
        client_reward: baseClientProfit,
        our_reward: baseOwnerProfit
      };

      // Add other fields if present in CSV
      if (row['Deposit Required']) {
        promotionData.deposit_required = parseNumeric(row['Deposit Required']) || 0;
      }
      if (row['Start Date']) {
        promotionData.start_date = row['Start Date'];
      }
      if (row['End Date']) {
        promotionData.end_date = row['End Date'];
      }
      if (row['Is Active']) {
        promotionData.is_active = parseBoolean(row['Is Active']);
      }

      if (existing) {
        // Update existing promotion
        const { error: updateError } = await supabase
          .from('promotions')
          .update(promotionData)
          .eq('id', existing.id);

        if (updateError) {
          console.error(`  ❌ Error updating promotion ${promotionName}:`, updateError);
        } else {
          updated++;
          count++;
        }
      } else {
        // Insert new promotion
        const { error: insertError } = await supabase
          .from('promotions')
          .insert(promotionData);

        if (insertError) {
          console.error(`  ❌ Error creating promotion ${promotionName}:`, insertError);
        } else {
          count++;
        }
      }
    } catch (error: any) {
      console.error(`  ❌ Error processing row:`, error);
      skipped++;
    }
  }

  console.log(`\n✅ Import completed!`);
  console.log(`  ✓ Imported/Updated: ${count} promotions`);
  console.log(`  ✓ Updated: ${updated} existing promotions`);
  console.log(`  ⚠ Skipped: ${skipped} rows`);

  // Step 4: Verify import
  console.log('\n📊 Step 4: Verifying import...');
  const { data: promotions, error: verifyError } = await supabase
    .from('promotions')
    .select('id, name, base_profit_client, base_profit_owner, dynamic_profit_allowed, detailed_conditions')
    .not('base_profit_client', 'is', null);

  if (verifyError) {
    console.error('  ❌ Error verifying import:', verifyError);
  } else {
    const withDynamic = promotions?.filter(p => p.dynamic_profit_allowed).length || 0;
    const withConditions = promotions?.filter(p => p.detailed_conditions).length || 0;
    console.log(`  ✓ Total promotions: ${promotions?.length || 0}`);
    console.log(`  ✓ With dynamic profits: ${withDynamic}`);
    console.log(`  ✓ With detailed conditions: ${withConditions}`);
  }
}

// Run import
if (require.main === module) {
  importPromotions()
    .then(() => {
      console.log('\n🎉 Script completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

export { importPromotions };

