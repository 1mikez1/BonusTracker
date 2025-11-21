/**
 * Excel to Supabase Migration Script
 * 
 * This script provides a template for migrating data from Excel files to Supabase.
 * 
 * Usage:
 * 1. Export your Excel sheets as CSV files
 * 2. Place CSV files in a `data/` directory
 * 3. Update the file paths and column mappings below
 * 4. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables
 * 5. Run: npx tsx scripts/migrate-excel-to-supabase.ts
 * 
 * Note: This is a template. You'll need to customize it based on your actual Excel structure.
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as csv from 'csv-parse/sync';

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

// Helper function to read CSV file
function readCSV(filePath: string): any[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  return csv.parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });
}

// Helper function to normalize app names
function normalizeAppName(name: string): string {
  return name.trim().toUpperCase();
}

// Step 1: Migrate Tiers
async function migrateTiers() {
  console.log('Migrating tiers...');
  
  // Example: Create default tiers if they don't exist
  const defaultTiers = [
    { name: 'TOP', priority: 1 },
    { name: 'TIER 1', priority: 2 },
    { name: 'TIER 2', priority: 3 },
    { name: '20IQ', priority: 4 }
  ];

  for (const tier of defaultTiers) {
    const { data, error } = await supabase
      .from('tiers')
      .upsert(tier, { onConflict: 'name' })
      .select()
      .single();

    if (error && error.code !== '23505') { // Ignore duplicate key errors
      console.error(`Error creating tier ${tier.name}:`, error);
    } else {
      console.log(`✓ Tier ${tier.name} ready`);
    }
  }
}

// Step 2: Migrate Apps
async function migrateApps() {
  console.log('Migrating apps...');
  
  // Read from your Excel export (e.g., apps.csv or extract from other sheets)
  // Example apps from the specification
  const apps = [
    { name: 'REVOLUT', app_type: 'bank', country: null, is_active: true },
    { name: 'BBVA', app_type: 'bank', country: null, is_active: true },
    { name: 'ISYBANK', app_type: 'bank', country: null, is_active: true },
    { name: 'BYBIT', app_type: 'cex', country: null, is_active: true },
    { name: 'KRAKEN', app_type: 'cex', country: null, is_active: true },
    { name: 'TRADING212', app_type: 'trading', country: null, is_active: true },
    { name: 'BUDDYBANK', app_type: 'bank', country: null, is_active: true },
    { name: 'SISAL', app_type: 'betting', country: null, is_active: true },
    { name: 'POKERSTARS', app_type: 'gambling', country: null, is_active: true }
  ];

  const appMap = new Map<string, string>(); // name -> id

  for (const app of apps) {
    const { data, error } = await supabase
      .from('apps')
      .upsert(app, { onConflict: 'name' })
      .select()
      .single();

    if (error && error.code !== '23505') {
      console.error(`Error creating app ${app.name}:`, error);
    } else if (data) {
      appMap.set(app.name, data.id);
      console.log(`✓ App ${app.name} ready (${data.id})`);
    }
  }

  return appMap;
}

// Step 3: Migrate Clients
async function migrateClients(appMap: Map<string, string>) {
  console.log('Migrating clients...');
  
  // Read from your Excel export (e.g., data/CLIENTI.csv)
  // This is a template - adjust based on your actual CSV structure
  const csvPath = path.join(process.cwd(), 'data', 'CLIENTI.csv');
  
  if (!fs.existsSync(csvPath)) {
    console.warn(`CSV file not found: ${csvPath}. Skipping client migration.`);
    console.log('Template: Create data/CLIENTI.csv with columns: name, surname, contact, email, trusted, tier, invited_by, notes');
    return new Map<string, string>();
  }

  const rows = readCSV(csvPath);
  const clientMap = new Map<string, string>(); // identifier -> id
  const tierMap = new Map<string, string>(); // tier name -> tier id

  // Get tier IDs
  const { data: tiers } = await supabase.from('tiers').select('id, name');
  if (tiers) {
    for (const tier of tiers) {
      tierMap.set(tier.name, tier.id);
    }
  }

  for (const row of rows) {
    // Map your CSV columns to database columns
    // Adjust these mappings based on your actual CSV structure
    const clientData = {
      name: row.name || row['Client name'] || '',
      surname: row.surname || row['Surname'] || null,
      contact: row.contact || row['Contact'] || row['Telegram'] || null,
      email: row.email || row['Email'] || null,
      trusted: row.trusted === 'TRUE' || row.trusted === '1' || row['Trusted'] === 'TRUE',
      tier_id: tierMap.get(row.tier || row['Tier'] || '') || null,
      invited_by_client_id: null, // Will be resolved in a second pass
      notes: row.notes || row['Notes'] || null
    };

    if (!clientData.name) {
      console.warn('Skipping row with missing name:', row);
      continue;
    }

    const { data, error } = await supabase
      .from('clients')
      .upsert(clientData, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      console.error(`Error creating client ${clientData.name}:`, error);
    } else if (data) {
      const identifier = `${clientData.name}_${clientData.contact || ''}`;
      clientMap.set(identifier, data.id);
      console.log(`✓ Client ${clientData.name} ready (${data.id})`);
    }
  }

  return clientMap;
}

// Step 4: Migrate Client-Apps (from per-app sheets)
async function migrateClientApps(appMap: Map<string, string>, clientMap: Map<string, string>) {
  console.log('Migrating client-apps...');
  
  // Example: Read from REVOLUT.csv, BBVA.csv, etc.
  const appNames = Array.from(appMap.keys());
  
  for (const appName of appNames) {
    const csvPath = path.join(process.cwd(), 'data', `${appName}.csv`);
    
    if (!fs.existsSync(csvPath)) {
      console.log(`Skipping ${appName} - CSV not found`);
      continue;
    }

    const rows = readCSV(csvPath);
    const appId = appMap.get(appName);

    if (!appId) {
      console.warn(`App ID not found for ${appName}`);
      continue;
    }

    for (const row of rows) {
      // Map CSV columns to client_apps structure
      // Adjust based on your actual CSV structure
      const clientName = row['Client'] || row['Client name'] || row.name || '';
      const clientContact = row['Contact'] || row['Telegram'] || '';
      const clientIdentifier = `${clientName}_${clientContact}`;
      const clientId = clientMap.get(clientIdentifier);

      if (!clientId) {
        console.warn(`Client not found for ${clientIdentifier} in ${appName}`);
        continue;
      }

      const clientAppData = {
        client_id: clientId,
        app_id: appId,
        status: 'requested', // Adjust based on your data
        deposited: row['Deposited'] === 'TRUE' || row['Deposited'] === '1',
        finished: row['Finished'] === 'TRUE' || row['Finished'] === '1',
        deposit_amount: row['Deposit amount'] ? parseFloat(row['Deposit amount']) : null,
        profit_client: null,
        profit_us: null,
        notes: row['Notes'] || null
      };

      const { data, error } = await supabase
        .from('client_apps')
        .upsert(clientAppData, { onConflict: 'client_id,app_id' })
        .select()
        .single();

      if (error && error.code !== '23505') {
        console.error(`Error creating client-app for ${clientName} on ${appName}:`, error);
      } else {
        console.log(`✓ Client-app ${clientName} → ${appName}`);
      }
    }
  }
}

// Step 5: Migrate Referral Links
async function migrateReferralLinks(appMap: Map<string, string>, clientMap: Map<string, string>) {
  console.log('Migrating referral links...');
  
  const csvPath = path.join(process.cwd(), 'data', 'INVITI.csv');
  
  if (!fs.existsSync(csvPath)) {
    console.warn('INVITI.csv not found. Skipping referral links migration.');
    return;
  }

  const rows = readCSV(csvPath);

  for (const row of rows) {
    const appName = normalizeAppName(row['App'] || row['App name'] || '');
    const appId = appMap.get(appName);

    if (!appId) {
      console.warn(`App not found for referral link: ${appName}`);
      continue;
    }

    const ownerName = row['Owner'] || row['Owner name'] || '';
    const ownerId = ownerName ? Array.from(clientMap.values()).find(() => {
      // Find client by name - you may need to adjust this logic
      return false; // Placeholder
    }) : null;

    const referralLinkData = {
      app_id: appId,
      url: row['URL'] || row['Referral URL'] || row['Code'] || '',
      owner_client_id: ownerId || null,
      max_uses: row['Max uses'] ? parseInt(row['Max uses']) : null,
      current_uses: row['Uses'] ? parseInt(row['Uses']) : 0,
      is_active: row['Active'] !== 'FALSE',
      notes: row['Notes'] || null
    };

    const { data, error } = await supabase
      .from('referral_links')
      .upsert(referralLinkData, { onConflict: 'app_id,url' })
      .select()
      .single();

    if (error && error.code !== '23505') {
      console.error(`Error creating referral link:`, error);
    } else {
      console.log(`✓ Referral link for ${appName}`);
    }
  }
}

// Step 6: Migrate Message Templates
async function migrateMessageTemplates(appMap: Map<string, string>) {
  console.log('Migrating message templates...');
  
  const csvPath = path.join(process.cwd(), 'data', 'GuideMessages.csv');
  
  if (!fs.existsSync(csvPath)) {
    console.warn('GuideMessages.csv not found. Skipping message templates migration.');
    return;
  }

  const rows = readCSV(csvPath);

  for (const row of rows) {
    const appName = row['App'] || row['app'] || '';
    const appId = appName ? appMap.get(normalizeAppName(appName)) : null;

    const templateData = {
      name: row['Name'] || row['name'] || '',
      app_id: appId || null,
      step: row['Step'] || row['step'] || null,
      language: row['Language'] || row['language'] || null,
      content: row['Content'] || row['content'] || row['Message'] || '',
      notes: row['Notes'] || row['notes'] || null
    };

    if (!templateData.name || !templateData.content) {
      console.warn('Skipping template with missing name or content:', row);
      continue;
    }

    const { data, error } = await supabase
      .from('message_templates')
      .insert(templateData)
      .select()
      .single();

    if (error) {
      console.error(`Error creating message template:`, error);
    } else {
      console.log(`✓ Message template ${templateData.name}`);
    }
  }
}

// Main migration function
async function main() {
  console.log('Starting Excel to Supabase migration...\n');

  try {
    // Step 1: Tiers
    await migrateTiers();

    // Step 2: Apps
    const appMap = await migrateApps();

    // Step 3: Clients
    const clientMap = await migrateClients(appMap);

    // Step 4: Client-Apps
    await migrateClientApps(appMap, clientMap);

    // Step 5: Referral Links
    await migrateReferralLinks(appMap, clientMap);

    // Step 6: Message Templates
    await migrateMessageTemplates(appMap);

    console.log('\n✓ Migration completed!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
if (require.main === module) {
  main();
}

export { main as migrateExcelToSupabase };

