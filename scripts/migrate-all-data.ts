/**
 * Complete Excel to Supabase Migration Script
 * 
 * This script migrates all data from the Excel CSV exports to Supabase.
 * 
 * Usage:
 * 1. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables
 * 2. Ensure CSV files are in the Data/ directory
 * 3. Run: npx tsx scripts/migrate-all-data.ts
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

// Helper function to read CSV file
function readCSV(filePath: string): any[] {
  if (!fs.existsSync(filePath)) {
    console.warn(`File not found: ${filePath}`);
    return [];
  }
  
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    // Handle BOM (Byte Order Mark) that some Excel exports include
    const contentWithoutBOM = content.charCodeAt(0) === 0xFEFF ? content.slice(1) : content;
    
    const records = parse(contentWithoutBOM, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
      bom: true,
      skip_records_with_error: true
    });
    
    // Filter out completely empty rows
    return records.filter((row: any) => {
      const values = Object.values(row);
      return values.some((val: any) => val && String(val).trim() !== '');
    });
  } catch (error: any) {
    console.error(`Error parsing CSV ${filePath}:`, error.message || error);
    return [];
  }
}

// Helper function to parse Italian date (DD/MM/YYYY)
function parseItalianDate(dateStr: string | null | undefined): string | null {
  if (!dateStr || dateStr.trim() === '' || dateStr === '/') return null;
  
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const [day, month, year] = parts;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return null;
}

// Helper function to parse numeric value (handles Italian format with comma)
function parseNumeric(value: string | null | undefined): number | null {
  if (!value || value.trim() === '' || value === 'FALSE' || value === 'TRUE') return null;
  // Handle Italian number format: "1.234,56" or "1,234.56" or "1234,56"
  let cleaned = String(value).replace(/[€$\s]/g, '');
  // If there's a comma, check if it's decimal separator (Italian) or thousands separator
  if (cleaned.includes(',')) {
    const parts = cleaned.split(',');
    if (parts.length === 2 && parts[1].length <= 2) {
      // Likely decimal separator (Italian format)
      cleaned = parts[0].replace(/\./g, '') + '.' + parts[1];
    } else {
      // Likely thousands separator, remove it
      cleaned = cleaned.replace(/,/g, '');
    }
  }
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

// Helper function to normalize app names
function normalizeAppName(name: string): string {
  const normalized = name.trim().toUpperCase();
  
  // Map common variations to standard names
  const nameMap: { [key: string]: string } = {
    'TRADE': 'TRADING212',
    'TRADEREPUBLIC': 'TRADEREPUBLIC',
    'TRADING 212': 'TRADING212',
    'BUDDY': 'BUDDYBANK',
    'BUDDY BANK': 'BUDDYBANK',
    'BYBIT EU': 'BYBIT',
    'DEBLOCK': 'DEBLOCK'
  };
  
  return nameMap[normalized] || normalized;
}

// Helper function to find or create client by name
async function findOrCreateClient(
  name: string,
  surname: string | null,
  contact: string | null,
  clientMap: Map<string, string>,
  trusted: boolean = false,
  email: string | null = null
): Promise<string | null> {
  const fullName = `${name} ${surname || ''}`.trim();
  const key = `${name.toLowerCase()}_${(surname || '').toLowerCase()}_${(contact || email || '').toLowerCase()}`;
  
  if (clientMap.has(key)) {
    const clientId = clientMap.get(key)!;
    // Update trusted status if provided
    if (trusted) {
      await supabase
        .from('clients')
        .update({ trusted: true })
        .eq('id', clientId);
    }
    return clientId;
  }

  // Try to find existing client
  const { data: existing, error: findError } = await supabase
    .from('clients')
    .select('id')
    .ilike('name', name)
    .limit(1)
    .maybeSingle();

  if (existing && !findError) {
    clientMap.set(key, existing.id);
    // Update trusted status if provided
    if (trusted) {
      await supabase
        .from('clients')
        .update({ trusted: true })
        .eq('id', existing.id);
    }
    return existing.id;
  }

  // Create new client
  const { data: newClient, error } = await supabase
    .from('clients')
    .insert({
      name,
      surname: surname || null,
      contact: contact || null,
      email: email || null,
      trusted: trusted,
      tier_id: null,
      invited_by_client_id: null
    })
    .select()
    .single();

  if (error) {
    console.error(`Error creating client ${fullName}:`, error);
    return null;
  }

  if (newClient) {
    clientMap.set(key, newClient.id);
    return newClient.id;
  }

  return null;
}

// Step 1: Migrate Tiers
async function migrateTiers(): Promise<Map<string, string>> {
  console.log('\n📊 Step 1: Migrating tiers...');
  
  const tiers = [
    { name: 'TOP', priority: 1 },
    { name: 'TIER 1', priority: 2 },
    { name: 'TIER 2', priority: 3 },
    { name: '20IQ', priority: 4 }
  ];

  const tierMap = new Map<string, string>();

  for (const tier of tiers) {
    const { data, error } = await supabase
      .from('tiers')
      .upsert(tier, { onConflict: 'name' })
      .select()
      .maybeSingle();

    if (error && error.code !== '23505') {
      console.error(`Error creating tier ${tier.name}:`, error);
    } else if (data) {
      tierMap.set(tier.name, data.id);
      console.log(`  ✓ Tier ${tier.name} ready`);
    }
  }

  return tierMap;
}

// Step 2: Migrate Apps
async function migrateApps(): Promise<Map<string, string>> {
  console.log('\n📱 Step 2: Migrating apps...');
  
  const apps = [
    { name: 'REVOLUT', app_type: 'bank', is_active: true },
    { name: 'BBVA', app_type: 'bank', is_active: true },
    { name: 'ISYBANK', app_type: 'bank', is_active: true },
    { name: 'BYBIT', app_type: 'cex', is_active: true },
    { name: 'KRAKEN', app_type: 'cex', is_active: true },
    { name: 'TRADING212', app_type: 'trading', is_active: true },
    { name: 'BUDDYBANK', app_type: 'bank', is_active: true },
    { name: 'SISAL', app_type: 'betting', is_active: true },
    { name: 'POKERSTARS', app_type: 'gambling', is_active: true },
    { name: 'ROBINHOOD', app_type: 'trading', is_active: true },
    { name: 'COINBASE', app_type: 'cex', is_active: true },
    { name: 'SKRILL', app_type: 'wallet', is_active: true },
    { name: 'TINABA', app_type: 'bank', is_active: true },
    { name: 'TRADEREPUBLIC', app_type: 'trading', is_active: true },
    { name: 'OKX', app_type: 'cex', is_active: true },
    { name: 'BUNQ', app_type: 'bank', is_active: true },
    { name: 'HYPE', app_type: 'bank', is_active: true },
    { name: 'BRIGHTY', app_type: 'bank', is_active: true },
    { name: 'DEBLOCK', app_type: 'bank', is_active: true }
  ];

  const appMap = new Map<string, string>();

  for (const app of apps) {
    const { data, error } = await supabase
      .from('apps')
      .upsert(app, { onConflict: 'name' })
      .select()
      .maybeSingle();

    if (error && error.code !== '23505') {
      console.error(`Error creating app ${app.name}:`, error);
    } else if (data) {
      appMap.set(app.name, data.id);
      // Also add normalized variations for lookup
      appMap.set(normalizeAppName(app.name), data.id);
      console.log(`  ✓ App ${app.name} ready`);
    }
  }
  
  // Update is_active based on active promotions after all apps are created
  // This will be done in a separate step or via SQL migration

  return appMap;
}

// Step 3: Migrate Clients from CLIENTI and TIER CLIENTI
async function migrateClientsFromTiers(
  tierMap: Map<string, string>,
  appMap: Map<string, string>
): Promise<Map<string, string>> {
  console.log('\n👥 Step 3: Migrating clients from CLIENTI and TIER CLIENTI...');
  
  const clientMap = new Map<string, string>();
  
  // First, migrate from CLIENTI.csv (has trusted status and more details)
  const clientiPath = path.join(DATA_DIR, 'New - BH', 'New - BH - CLIENTI.csv');
  const clientiRows = readCSV(clientiPath);
  
  let clientiCount = 0;
  if (clientiRows.length > 0) {
    for (const row of clientiRows) {
      const fullName = row['Nome|Cognome'] || '';
      if (!fullName || fullName.trim() === '') continue;

      const nameParts = fullName.split('|');
      const name = nameParts[0]?.trim() || '';
      const surname = nameParts[1]?.trim() || null;
      
      if (!name) continue;

      const trusted = row['TRUSTED'] === 'TRUE' || row['TRUSTED'] === 'true';
      const referrerName = row['Nome referente'] || null;
      const notes = row['Note'] || null;
      
      const clientId = await findOrCreateClient(name, surname, null, clientMap, trusted);
      
      if (clientId) {
        // Update notes if provided
        if (notes) {
          await supabase
            .from('clients')
            .update({ notes })
            .eq('id', clientId);
        }
        clientiCount++;
      }
    }
    console.log(`  ✓ Processed ${clientiCount} clients from CLIENTI`);
  }

  // Then, migrate from TIER CLIENTI.csv (for tier assignments)
  const tierPath = path.join(DATA_DIR, 'New - BH', 'New - BH - TIER CLIENTI.csv');
  const tierRows = readCSV(tierPath);
  
  let tierCount = 0;
  if (tierRows.length > 0) {
    const tierColumns = ['TOP', 'TIER 1', 'TIER 2', '20 IQ'];

    for (const row of tierRows) {
      for (const tierName of tierColumns) {
        const clientName = row[tierName];
        if (!clientName || clientName.trim() === '') continue;

        const nameParts = clientName.trim().split(' ');
        const name = nameParts[0];
        const surname = nameParts.slice(1).join(' ') || null;
        
        const tierId = tierMap.get(tierName === '20 IQ' ? '20IQ' : tierName) || null;
        
        const clientId = await findOrCreateClient(name, surname, null, clientMap, false);
        
        if (clientId && tierId) {
          await supabase
            .from('clients')
            .update({ tier_id: tierId })
            .eq('id', clientId);
          tierCount++;
        }
      }
    }
    console.log(`  ✓ Processed ${tierCount} tier assignments`);
  }

  console.log(`  ✓ Total: ${clientMap.size} clients processed`);
  return clientMap;
}

// Step 4: Migrate Requests (MODULO)
async function migrateRequests(
  clientMap: Map<string, string>,
  appMap: Map<string, string>
): Promise<void> {
  console.log('\n📝 Step 4: Migrating requests (MODULO)...');
  
  const csvPath = path.join(DATA_DIR, 'New - BH', 'New - BH - MODULO.csv');
  const rows = readCSV(csvPath);
  
  let count = 0;
  for (const row of rows) {
    const name = row['Nome'] || row['Nome '] || '';
    if (!name || name.trim() === '') continue;

    const nameParts = name.trim().split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || null;
    
    const contact = row['Mail'] || row['Contatto'] || null;
    const requestedApps = row['App richieste'] || row['App'] || '';
    const timestamp = row['Timestamp'] || row['Data'] || null;

    // Check if request already exists (by name + contact + requested apps)
    const { data: existing } = await supabase
      .from('requests')
      .select('id')
      .eq('name', firstName)
      .eq('contact', contact || '')
      .eq('requested_apps_raw', requestedApps || '')
      .maybeSingle();

    if (existing) {
      // Request already exists, skip
      continue;
    }

    const { error } = await supabase
      .from('requests')
      .insert({
        name: firstName,
        contact: contact,
        requested_apps_raw: requestedApps || null,
        status: 'new',
        notes: lastName ? `Surname: ${lastName}` : null
      });

    if (error && error.code !== '23505') {
      console.error(`Error creating request for ${name}:`, error);
    } else {
      count++;
    }
  }

  console.log(`  ✓ Migrated ${count} requests`);
}

// Step 5: Migrate Client-Apps from per-app sheets (NEW-J)
async function migrateClientAppsFromSheets(
  clientMap: Map<string, string>,
  appMap: Map<string, string>
): Promise<void> {
  console.log('\n📋 Step 5: Migrating client-apps from per-app sheets...');
  
  const appFiles = [
    { file: 'NEW - J - REVOLUT.csv', appName: 'REVOLUT' },
    { file: 'NEW - J - BBVA.csv', appName: 'BBVA' },
    { file: 'NEW - J - ISYBANK.csv', appName: 'ISYBANK' },
    { file: 'NEW - J - BYBIT.csv', appName: 'BYBIT' },
    { file: 'NEW - J - KRAKEN.csv', appName: 'KRAKEN' },
    { file: 'NEW - J - TRADING212.csv', appName: 'TRADING212' },
    { file: 'NEW - J - BUDDYBANK.csv', appName: 'BUDDYBANK' },
    { file: 'NEW - J - SISAL.csv', appName: 'SISAL' },
    { file: 'NEW - J - POKERSTARS.csv', appName: 'POKERSTARS' }
  ];

  let totalCount = 0;

  for (const { file, appName } of appFiles) {
    const csvPath = path.join(DATA_DIR, 'New - J', file);
    const rows = readCSV(csvPath);
    const appId = appMap.get(appName);
    
    if (!appId) {
      console.log(`  ⚠ App ${appName} not found, skipping`);
      continue;
    }

    let count = 0;
    for (const row of rows) {
      const fullName = row['Nome|Cognome'] || row['Nome'] || '';
      if (!fullName || fullName.trim() === '') continue;

      const nameParts = fullName.split('|');
      const name = nameParts[0]?.trim() || '';
      const surname = nameParts[1]?.trim() || nameParts[0]?.split(' ').slice(1).join(' ') || null;
      
      if (!name) continue;

      const contact = row['Mail'] || null;
      const clientId = await findOrCreateClient(name, surname, contact, clientMap, false);
      
      if (!clientId) continue;

      // Determine status from flags
      const contoAperto = row['Conto aperto'] === 'TRUE' || row['Conto aperto'] === 'SI';
      const completata = row['Completata'] === 'TRUE' || row['Completata'] === 'SI';
      const ricevuta = row['Ricevuta'] === 'TRUE' || row['Ricevuta'] === 'SI';
      const iniziata = row['Iniziata'] === 'TRUE' || row['Iniziata'] === 'SI';
      
      let status = 'requested';
      if (completata && ricevuta) {
        status = 'paid';
      } else if (completata) {
        status = 'completed';
      } else if (ricevuta) {
        status = 'waiting_bonus';
      } else if (contoAperto) {
        status = 'registered';
      }

      const depositAmount = parseNumeric(row['Importo deposito'] || row['Data deposito']);
      const depositDate = parseItalianDate(row['Data deposito'] || row['Data ricarica']);

      const { error } = await supabase
        .from('client_apps')
        .upsert({
          client_id: clientId,
          app_id: appId,
          status,
          deposited: contoAperto || depositAmount !== null,
          finished: completata,
          deposit_amount: depositAmount,
          notes: row['Note'] || row['Note apertura'] || null
        }, { 
          onConflict: 'client_id,app_id'
        });

      if (error && error.code !== '23505') {
        console.error(`Error creating client-app for ${name} on ${appName}:`, error);
      } else {
        count++;
      }
    }

    console.log(`  ✓ ${appName}: ${count} client-apps`);
    totalCount += count;
  }

  console.log(`  ✓ Total: ${totalCount} client-apps migrated`);
}

// Step 6: Migrate Referral Links (New - BH - Inviti)
async function migrateReferralLinks(
  clientMap: Map<string, string>,
  appMap: Map<string, string>
): Promise<void> {
  console.log('\n🔗 Step 6: Migrating referral links...');
  
  const csvPath = path.join(DATA_DIR, 'New - BH', 'New - BH - Inviti.csv');
  const rows = readCSV(csvPath);
  
  if (rows.length === 0) {
    console.log('  ⚠ No referral link data found');
    return;
  }

  // The CSV has a complex structure with multiple apps in columns
  // First row contains app names, subsequent rows contain link data
  const headerRow = rows[0];
  const appColumns: { app: string; accountCol: string; codeCol: string; usedCol: string }[] = [];
  
  // Parse header to find app columns
  for (const [key, value] of Object.entries(headerRow)) {
    if (value && typeof value === 'string') {
      const appName = normalizeAppName(value);
      if (appMap.has(appName)) {
        // Find corresponding Account, Codice, Usato columns
        const accountCol = key.replace(/^[^,]+/, '').includes('Account') ? key : null;
        // This is simplified - you may need to adjust based on actual structure
      }
    }
  }

  // Simplified approach: look for URL patterns
  let count = 0;
  for (const row of rows) {
    for (const [key, value] of Object.entries(row)) {
      if (typeof value === 'string' && (value.includes('http') || value.includes('referral') || value.includes('invite'))) {
        // Try to determine app from context
        const appNames = Array.from(appMap.keys());
        for (const appName of appNames) {
          if (value.toLowerCase().includes(appName.toLowerCase()) || 
              (appName === 'REVOLUT' && value.includes('revolut.com')) ||
              (appName === 'KRAKEN' && value.includes('kraken.com'))) {
            const appId = appMap.get(appName);
            if (appId) {
              const ownerName = row['Account'] || row['Usato_da'] || null;
              let ownerId = null;
              
              if (ownerName) {
                // Try to find owner client
                const { data: owner } = await supabase
                  .from('clients')
                  .select('id')
                  .ilike('name', ownerName.split(' ')[0])
                  .limit(1)
                  .maybeSingle();
                if (owner) ownerId = owner.id;
              }

              const isUsed = row['Usato'] === 'TRUE' || row['Stato'] === 'Usato';
              const currentUses = isUsed ? 1 : 0;

              const { error } = await supabase
                .from('referral_links')
                .upsert({
                  app_id: appId,
                  url: value,
                  owner_client_id: ownerId,
                  current_uses: currentUses,
                  is_active: !isUsed
                }, { onConflict: 'app_id,url' });

              if (!error) count++;
              break;
            }
          }
        }
      }
    }
  }

  console.log(`  ✓ Migrated ${count} referral links`);
}

// Step 7: Migrate Credentials (Mail)
async function migrateCredentials(
  clientMap: Map<string, string>,
  appMap: Map<string, string>
): Promise<void> {
  console.log('\n🔐 Step 7: Migrating credentials...');
  
  const csvPath = path.join(DATA_DIR, 'New - BH', 'New - BH - Mail.csv');
  const rows = readCSV(csvPath);
  
  let count = 0;
  for (const row of rows) {
    // Mail.csv has: Username, Password, STATO, Cliente, Note
    const email = row['Username'] || row['Mail'] || row['User'] || null;
    const password = row['Password'] || row['Psw'] || null;
    const clientName = row['Cliente'] || '';
    
    if (!email || !password) continue;

    // Try to find client by email first, then by name
    let clientId: string | null = null;
    
    if (email) {
      const { data: clientByEmail } = await supabase
        .from('clients')
        .select('id')
        .eq('email', email)
        .maybeSingle();
      
      if (clientByEmail) {
        clientId = clientByEmail.id;
      }
    }
    
    // If not found by email, try by name
    if (!clientId && clientName) {
      const nameParts = clientName.trim().split(' ');
      const name = nameParts[0];
      const surname = nameParts.slice(1).join(' ') || null;
      clientId = await findOrCreateClient(name, surname, null, clientMap, false, email);
    }
    
    // If still not found, create with email as identifier
    if (!clientId) {
      // Extract name from email (before @)
      const emailName = email.split('@')[0];
      // Try to parse name from email (e.g., "luisaciappellano001" -> "Luisa Ciappellano")
      // This is a fallback - ideally the Cliente column should be populated
      clientId = await findOrCreateClient(emailName, null, null, clientMap, false, email);
    }
    
    if (!clientId) {
      console.warn(`Could not find or create client for email ${email}`);
      continue;
    }

    // Determine app from STATO or default to REVOLUT
    // STATO might indicate the app, but for now default to REVOLUT
    const appName = 'REVOLUT'; // Default - you may need to parse STATO column
    const appId = appMap.get(appName);
    
    if (!appId) continue;

    // Check if credential already exists
    const { data: existing } = await supabase
      .from('credentials')
      .select('id')
      .eq('client_id', clientId)
      .eq('app_id', appId)
      .maybeSingle();

    if (existing) {
      // Update existing credential
      const passwordEncrypted = Buffer.from(password).toString('base64');
      const { error } = await supabase
        .from('credentials')
        .update({
          email,
          password_encrypted: passwordEncrypted,
          notes: row['Note'] || null
        })
        .eq('id', existing.id);
      
      if (!error) count++;
    } else {
      // Insert new credential
      const passwordEncrypted = Buffer.from(password).toString('base64');
      const { error } = await supabase
        .from('credentials')
        .insert({
          client_id: clientId,
          app_id: appId,
          email,
          password_encrypted: passwordEncrypted,
          notes: row['Note'] || null
        });

      if (error && error.code !== '23505') {
        console.error(`Error creating credential for ${email}:`, error);
      } else {
        count++;
      }
    }
  }

  console.log(`  ✓ Migrated ${count} credentials`);
}

// Step 8: Migrate Promotions
async function migratePromotions(appMap: Map<string, string>): Promise<void> {
  console.log('\n🎁 Step 8: Migrating promotions...');
  
  const csvPath = path.join(DATA_DIR, 'New - BH', 'New - BH - Promozioni.csv');
  const rows = readCSV(csvPath);
  
  let count = 0;
  for (const row of rows) {
    const appName = normalizeAppName(row['Colonna 1'] || '');
    if (!appName || appName === '') continue;

    const appId = appMap.get(appName);
    if (!appId) continue;

    const clientReward = parseNumeric(row['Profitto cliente']);
    const ourReward = parseNumeric(row['Ricavo nostro']);
    const depositRequired = parseNumeric(row['Deposito']);
    const expense = parseNumeric(row['Spesa']);
    const isActive = row['ATTIVA'] === 'TRUE';
    const profitType = row['Tipo Profit'] || 'CASH';
    const maxInvitesStr = row['Numero inviti'] || '';
    // Parse max invites (handle formats like "5/MESE", "5", "1000")
    let maxInvites: number | null = null;
    if (maxInvitesStr && maxInvitesStr !== '/') {
      const numericPart = maxInvitesStr.split('/')[0].trim();
      const parsed = parseInt(numericPart, 10);
      if (!isNaN(parsed)) {
        maxInvites = parsed;
      }
    }

    if (!clientReward && !ourReward) continue;

    const endDate = parseItalianDate(row['Scadenza']);
    const timeToGetBonus = row['Tempistiche ricezione'] || null;

    // Check if promotion already exists for this app
    const { data: existing } = await supabase
      .from('promotions')
      .select('id')
      .eq('app_id', appId)
      .eq('name', `${appName} Promotion`)
      .maybeSingle();

    const promotionData: any = {
      client_reward: clientReward || 0,
      our_reward: ourReward || 0,
      deposit_required: depositRequired || 0,
      end_date: endDate,
      time_to_get_bonus: timeToGetBonus,
      terms_conditions: row['T&C'] || null,
      notes: row['Note'] || null
    };
    
    // Only include new fields if they exist in the schema (after migration 0002)
    // These fields will be added by migration 0002_add_promotions_fields.sql
    // For now, we'll try to include them, but the migration should be run first
    try {
      // Try to include new fields - if migration hasn't been run, these will fail gracefully
      promotionData.is_active = isActive;
      if (profitType && profitType !== 'CASH') {
        promotionData.profit_type = profitType;
      }
      if (expense !== null) {
        promotionData.expense = expense;
      }
      if (maxInvites !== null) {
        promotionData.max_invites = maxInvites;
      }
    } catch (e) {
      // If new columns don't exist, continue without them
      console.warn(`Note: Some promotion fields may not be available. Please run migration 0002_add_promotions_fields.sql first.`);
    }

    let error = null;
    if (existing) {
      // Update existing promotion - try with all fields first
      const { error: updateError } = await supabase
        .from('promotions')
        .update(promotionData)
        .eq('id', existing.id);
      error = updateError;
      
      // If error is about missing columns, retry without new fields
      if (error && (error.code === 'PGRST204' || error.message?.includes('column'))) {
        const basicPromotionData: any = {
          client_reward: clientReward || 0,
          our_reward: ourReward || 0,
          deposit_required: depositRequired || 0,
          end_date: endDate,
          time_to_get_bonus: timeToGetBonus,
          terms_conditions: row['T&C'] || null,
          notes: row['Note'] || null
        };
        const { error: retryError } = await supabase
          .from('promotions')
          .update(basicPromotionData)
          .eq('id', existing.id);
        error = retryError;
      }
    } else {
      // Insert new promotion - try with all fields first
      const { error: insertError } = await supabase
        .from('promotions')
        .insert({
          app_id: appId,
          name: `${appName} Promotion`,
          ...promotionData
        });
      error = insertError;
      
      // If error is about missing columns, retry without new fields
      if (error && (error.code === 'PGRST204' || error.message?.includes('column'))) {
        const basicPromotionData: any = {
          client_reward: clientReward || 0,
          our_reward: ourReward || 0,
          deposit_required: depositRequired || 0,
          end_date: endDate,
          time_to_get_bonus: timeToGetBonus,
          terms_conditions: row['T&C'] || null,
          notes: row['Note'] || null
        };
        const { error: retryError } = await supabase
          .from('promotions')
          .insert({
            app_id: appId,
            name: `${appName} Promotion`,
            ...basicPromotionData
          });
        error = retryError;
      }
    }

    if (error && error.code !== '23505') {
      console.error(`Error creating promotion for ${appName}:`, error);
    } else {
      count++;
    }
  }

  console.log(`  ✓ Migrated ${count} promotions`);
}

// Step 9: Migrate Debts (Lista Bybit_kraken)
async function migrateDebts(
  clientMap: Map<string, string>,
  appMap: Map<string, string>
): Promise<void> {
  console.log('\n💰 Step 9: Migrating debts...');
  
  const csvPath = path.join(DATA_DIR, 'New - BH', 'New - BH - Lista Bybit_kraken.csv');
  const rows = readCSV(csvPath);
  
  let count = 0;
  for (const row of rows) {
    const creditorName = row['Nome '] || row['A chi'] || '';
    const debtorName = row['Nome'] || '';
    const amount = parseNumeric(row['Debito'] || row['Dati']);
    
    if (!creditorName || !amount) continue;

    // Find creditor client
    const creditorParts = creditorName.split(' ');
    const { data: creditor, error: creditorError } = await supabase
      .from('clients')
      .select('id')
      .ilike('name', creditorParts[0])
      .limit(1)
      .maybeSingle();

    if (!creditor || creditorError) continue;

    // Find debtor client if specified
    let debtorId = null;
    if (debtorName) {
      const debtorParts = debtorName.split(' ');
      const { data: debtor } = await supabase
        .from('clients')
        .select('id')
        .ilike('name', debtorParts[0])
        .limit(1)
        .maybeSingle();
      if (debtor) debtorId = debtor.id;
    }

    // Determine app (Bybit or Kraken based on context)
    const appId = appMap.get('BYBIT') || appMap.get('KRAKEN');

    if (!appId) continue;

    // Find or create a referral link for this debt
    let referralLinkId: string | null = null;
    
    // Try to find an existing referral link for this app
    const { data: referralLink } = await supabase
      .from('referral_links')
      .select('id')
      .eq('app_id', appId)
      .limit(1)
      .maybeSingle();

    if (referralLink) {
      referralLinkId = referralLink.id;
    } else {
      // Create a placeholder referral link if none exists
      // This is required because referral_link_id is NOT NULL
      const { data: newLink, error: linkError } = await supabase
        .from('referral_links')
        .insert({
          app_id: appId,
          url: `placeholder-${appId}-${Date.now()}`,
          is_active: false,
          notes: 'Auto-created placeholder for debt migration'
        })
        .select()
        .maybeSingle();
      
      if (newLink && !linkError) {
        referralLinkId = newLink.id;
      } else {
        console.error(`Error creating placeholder referral link for ${appId}:`, linkError);
        continue; // Skip this debt if we can't create a referral link
      }
    }

    // Check if debt already exists (by creditor, debtor, amount, and referral link)
    const { data: existingDebt } = await supabase
      .from('referral_link_debts')
      .select('id')
      .eq('creditor_client_id', creditor.id)
      .eq('referral_link_id', referralLinkId)
      .eq('amount', amount)
      .maybeSingle();

    if (existingDebt) {
      // Debt already exists, skip
      continue;
    }

    const { error } = await supabase
      .from('referral_link_debts')
      .insert({
        referral_link_id: referralLinkId,
        creditor_client_id: creditor.id,
        debtor_client_id: debtorId,
        amount,
        status: 'open',
        description: row['commissioni'] || null
      });

    if (error && error.code !== '23505') {
      console.error(`Error creating debt:`, error);
    } else {
      count++;
    }
  }

  console.log(`  ✓ Migrated ${count} debts`);
}

// Step 10: Migrate Payment Links
async function migratePaymentLinks(
  clientMap: Map<string, string>,
  appMap: Map<string, string>
): Promise<void> {
  console.log('\n💳 Step 10: Migrating payment links...');
  
  const csvPath = path.join(DATA_DIR, 'New - BH', 'New - BH - Link_pagamenti.csv');
  const rows = readCSV(csvPath);
  
  let count = 0;
  for (const row of rows) {
    // The CSV structure has amounts in first column and URLs in subsequent columns
    const amountStr = Object.values(row)[0] as string;
    const amount = parseNumeric(amountStr);
    
    if (!amount) continue;

    // Find URLs in the row
    for (const [key, value] of Object.entries(row)) {
      if (typeof value === 'string' && value.includes('http')) {
        const provider = value.includes('sumup') ? 'SumUp' : 'Other';
        
        // Check if payment link already exists (by URL)
        const { data: existing } = await supabase
          .from('payment_links')
          .select('id')
          .eq('url', value)
          .maybeSingle();

        if (existing) {
          // Payment link already exists, skip
          continue;
        }
        
        const { error } = await supabase
          .from('payment_links')
          .insert({
            provider,
            url: value,
            amount,
            purpose: 'deposit',
            used: false
          });

        if (!error) count++;
      }
    }
  }

  console.log(`  ✓ Migrated ${count} payment links`);
}

// Step 11: Migrate Slots (RTP slot sisal)
async function migrateSlots(): Promise<void> {
  console.log('\n🎰 Step 11: Migrating slots...');
  
  const csvPath = path.join(DATA_DIR, 'New - J', 'NEW - J - RTP slot sisal.csv');
  const rows = readCSV(csvPath);
  
  let count = 0;
  for (const row of rows) {
    const name = row['Nome'] || row['Slot'] || '';
    // RTP is in format like "94,57%" - need to parse percentage and handle comma
    const rtpStr = row['RTP'] || row['RTP%'] || '';
    let rtp: number | null = null;
    
    if (rtpStr) {
      // Remove % sign and parse Italian number format
      const cleaned = rtpStr.replace('%', '').trim();
      rtp = parseNumeric(cleaned);
    }
    
    if (!name || !rtp) {
      if (name) {
        console.warn(`  ⚠ Skipping slot ${name} - invalid RTP: ${rtpStr}`);
      }
      continue;
    }

    // Check if slot already exists
    const { data: existing } = await supabase
      .from('slots')
      .select('id')
      .eq('name', name)
      .maybeSingle();

    let error = null;
    if (existing) {
      // Update existing slot
      const { error: updateError } = await supabase
        .from('slots')
        .update({
          provider: row['Provider'] || null,
          rtp_percentage: rtp,
          notes: row['Note'] || null
        })
        .eq('id', existing.id);
      error = updateError;
    } else {
      // Insert new slot
      const { error: insertError } = await supabase
        .from('slots')
        .insert({
          name,
          provider: row['Provider'] || null,
          rtp_percentage: rtp,
          notes: row['Note'] || null
        });
      error = insertError;
    }

    if (error && error.code !== '23505') {
      console.error(`Error creating slot ${name}:`, error);
    } else {
      count++;
    }
  }

  console.log(`  ✓ Migrated ${count} slots`);
}

// Step 12: Migrate Message Templates (Guide)
async function migrateMessageTemplates(appMap: Map<string, string>): Promise<void> {
  console.log('\n📧 Step 12: Migrating message templates...');
  
  const csvPath = path.join(DATA_DIR, 'Guide app - Guide.csv');
  
  if (!fs.existsSync(csvPath)) {
    console.log('  ⚠ Guide app - Guide.csv not found');
    return;
  }

  // Read CSV manually - it has NO headers, just 3 columns: App, Step, Content
  // Structure: When column 1 has a value, it's a new app. Empty column 1 means same app as previous row
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
    console.log('  ⚠ No data rows found');
    return;
  }

  let count = 0;
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
        console.log(`  ℹ Processing Onboard template`);
      } else {
        // Try to find app by normalized name
        currentAppId = appMap.get(normalizedAppName) || null;
        
        // If not found, try partial match
        if (!currentAppId) {
          for (const [appName, appId] of appMap.entries()) {
            if (normalizedAppName.includes(appName) || appName.includes(normalizedAppName)) {
              currentAppId = appId;
              console.log(`  ℹ Matched "${appNameRaw}" to app "${appName}"`);
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
    
    // If no app name in this row but we have a currentApp, continue with it
    // This handles rows where column 1 is empty (same app as previous row)
    
    // Skip if no step name (invalid row)
    if (!stepName) {
      continue;
    }
    
    // Skip if content is too short (likely empty or invalid)
    if (!content || content.length < 5) {
      continue;
    }
    
    // Filter out templates that have "Other" as step and contain Onboard content
    // These are likely misclassified templates that should be in Onboard
    const contentLower = content.toLowerCase();
    const stepLower = stepName.toLowerCase();
    
    // Skip "Other" and "introduction" steps for all apps (these are usually misclassified)
    if ((stepName === 'Other' || stepLower === 'introduction' || stepLower === 'intro') && currentAppId) {
      console.log(`  ⚠ Skipping misclassified template for ${currentApp}: ${stepName}`);
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
        console.log(`  ⚠ Moving Onboard template from ${currentApp} to generic Onboard: ${stepName}`);
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
    
    // Debug log for Onboard templates
    if (currentAppId === null) {
      console.log(`  📝 Creating Onboard template: "${templateName}" (step: "${stepName}")`);
    }
    
    // Check if template already exists (by name and app_id combination)
    // Since we're doing a clean migration, check first to avoid duplicates
    // For NULL app_id, we need to use .is('app_id', null) instead of .eq()
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
        if (currentAppId === null) {
          console.log(`  ✓ Updated Onboard template: "${templateName}"`);
        }
      } else {
        console.error(`Error updating template ${templateName}:`, error);
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
          console.log(`  ⚠ Duplicate template skipped: ${templateName} (app_id: ${currentAppId || 'null'})`);
        } else {
          console.error(`Error creating template ${templateName}:`, error);
          if (currentAppId === null) {
            console.error(`  Failed to create Onboard template: ${templateName}`);
          }
        }
      } else {
        count++;
        if (currentAppId === null) {
          console.log(`  ✓ Created Onboard template: "${templateName}"`);
        }
      }
    }
  }

  console.log(`  ✓ Migrated ${count} message templates`);
}

// Main migration function
async function main() {
  console.log('🚀 Starting complete Excel to Supabase migration...\n');

  try {
    // Step 1: Tiers
    const tierMap = await migrateTiers();

    // Step 2: Apps
    const appMap = await migrateApps();

    // Step 3: Clients from tiers
    const clientMap = await migrateClientsFromTiers(tierMap, appMap);

    // Step 4: Requests
    await migrateRequests(clientMap, appMap);

    // Step 5: Client-Apps from per-app sheets
    await migrateClientAppsFromSheets(clientMap, appMap);

    // Step 6: Referral Links
    await migrateReferralLinks(clientMap, appMap);

    // Step 7: Credentials
    await migrateCredentials(clientMap, appMap);

    // Step 8: Promotions
    await migratePromotions(appMap);

    // Step 9: Debts
    await migrateDebts(clientMap, appMap);

    // Step 10: Payment Links
    await migratePaymentLinks(clientMap, appMap);

    // Step 11: Slots
    await migrateSlots();

    // Step 12: Message Templates
    await migrateMessageTemplates(appMap);

    console.log('\n✅ Migration completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`  - Tiers: ${tierMap.size}`);
    console.log(`  - Apps: ${appMap.size}`);
    console.log(`  - Clients: ${clientMap.size}`);
    console.log('\n💡 Next steps:');
    console.log('  1. Review the data in Supabase dashboard');
    console.log('  2. Update any missing relationships manually');
    console.log('  3. Test the application with real data');
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
if (require.main === module) {
  main();
}

export { main as migrateAllData };

