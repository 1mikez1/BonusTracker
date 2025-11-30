/**
 * Script to import referral links from CSV file
 * 
 * CSV format expected:
 * - appName: Name of the app (e.g., "Kraken")
 * - accountName: Account name for grouping (e.g., "Luna", "Main Account")
 * - code: Referral code (optional, will be extracted from URL if not provided)
 * - referralUrl: The referral URL
 * - status: active, inactive, redeemed, expired (default: active)
 * - usedAt: Date when used (optional, ISO format)
 * - usedBy: Operator name who recorded usage (optional, e.g., "Luna")
 * - customerName: Client name who used it (optional)
 * - redeemed: true/false (default: false)
 * - notes: Additional notes (optional)
 * 
 * Usage:
 *   npx tsx scripts/import-referrals-from-csv.ts path/to/referrals.csv
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

interface ReferralCSVRow {
  appName: string;
  accountName?: string;
  code?: string;
  referralUrl: string;
  status?: 'active' | 'inactive' | 'redeemed' | 'expired';
  usedAt?: string;
  usedBy?: string;
  customerName?: string;
  redeemed?: string | boolean;
  notes?: string;
}

interface ReferralLink {
  app_id: string;
  account_name: string | null;
  code: string | null;
  url: string;
  normalized_url: string | null;
  status: 'active' | 'inactive' | 'redeemed' | 'expired';
  url_validation_status: 'valid' | 'invalid' | 'needs_review' | 'pending';
  is_active: boolean;
  notes: string | null;
  owner_client_id: string | null;
}

interface ReferralUsage {
  referral_link_id: string;
  client_id: string | null;
  used_at: string;
  used_by: string | null;
  redeemed: boolean;
  notes: string | null;
}

// Normalize URL function (matches database function)
function normalizeUrl(url: string): string | null {
  let normalized = url.trim();
  normalized = normalized.replace(/^\s+|\s+$/g, '');
  normalized = normalized.replace(/^http:\/\//i, 'https://');
  
  // Basic validation
  if (!/^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(normalized)) {
    return null;
  }
  
  return normalized;
}

// Extract code from URL (matches database function)
function extractCode(url: string): string | null {
  // Try ?ref=CODE or &ref=CODE
  let match = url.match(/[?&]ref=([^&]+)/i);
  if (match) return decodeURIComponent(match[1]);
  
  // Try ?code=CODE or &code=CODE
  match = url.match(/[?&]code=([^&]+)/i);
  if (match) return decodeURIComponent(match[1]);
  
  // Try ?referral=CODE or &referral=CODE
  match = url.match(/[?&]referral=([^&]+)/i);
  if (match) return decodeURIComponent(match[1]);
  
  // Try /ref/CODE or /referral/CODE
  match = url.match(/\/(?:ref|referral)\/([^/?&]+)/i);
  if (match) return decodeURIComponent(match[1]);
  
  return null;
}

// Validate URL
function validateUrl(url: string): 'valid' | 'invalid' | 'needs_review' | 'pending' {
  const normalized = normalizeUrl(url);
  if (!normalized) return 'invalid';
  
  if (/\s/.test(url)) return 'needs_review'; // Has spaces
  if (!/^https?:\/\//i.test(url)) return 'needs_review'; // Missing protocol
  
  return 'valid';
}

async function main() {
  const csvPath = process.argv[2];
  
  if (!csvPath) {
    console.error('Usage: npx tsx scripts/import-referrals-from-csv.ts path/to/referrals.csv');
    process.exit(1);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables:');
    console.error('  NEXT_PUBLIC_SUPABASE_URL');
    console.error('  NEXT_PUBLIC_SUPABASE_ANON_KEY');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Read and parse CSV
  console.log(`Reading CSV from: ${csvPath}`);
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  
  const records: ReferralCSVRow[] = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });

  console.log(`Found ${records.length} rows in CSV`);

  // Get all apps to create mapping
  const { data: apps, error: appsError } = await supabase
    .from('apps')
    .select('id, name');

  if (appsError) {
    console.error('Error fetching apps:', appsError);
    process.exit(1);
  }

  const appMap = new Map<string, string>();
  apps?.forEach(app => {
    appMap.set(app.name.toLowerCase(), app.id);
  });

  // Get all clients to create mapping
  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select('id, name, surname');

  if (clientsError) {
    console.error('Error fetching clients:', clientsError);
    process.exit(1);
  }

  const clientMap = new Map<string, string>();
  clients?.forEach(client => {
    const fullName = `${client.name} ${client.surname || ''}`.trim().toLowerCase();
    clientMap.set(fullName, client.id);
  });

  console.log(`Loaded ${appMap.size} apps and ${clientMap.size} clients`);

  // Process referrals
  const referralLinks: ReferralLink[] = [];
  const referralUsages: Array<ReferralUsage & { appName: string; accountName?: string; customerName?: string }> = [];

  for (const row of records) {
    const appId = appMap.get(row.appName.toLowerCase());
    if (!appId) {
      console.warn(`⚠️  App not found: ${row.appName}, skipping row`);
      continue;
    }

    const normalizedUrl = normalizeUrl(row.referralUrl);
    const code = row.code || extractCode(row.referralUrl);
    const validationStatus = validateUrl(row.referralUrl);
    const status = row.status || 'active';
    const isActive = status === 'active';

    // Check if referral link already exists
    const { data: existing } = await supabase
      .from('referral_links')
      .select('id')
      .eq('app_id', appId)
      .eq('url', row.referralUrl)
      .single();

    let referralLinkId: string;

    if (existing) {
      // Update existing
      referralLinkId = existing.id;
      const { error: updateError } = await supabase
        .from('referral_links')
        .update({
          account_name: row.accountName || null,
          code: code,
          normalized_url: normalizedUrl,
          status: status,
          url_validation_status: validationStatus,
          is_active: isActive,
          notes: row.notes || null
        })
        .eq('id', referralLinkId);

      if (updateError) {
        console.error(`Error updating referral link:`, updateError);
        continue;
      }
      console.log(`✓ Updated referral link: ${row.referralUrl.substring(0, 50)}...`);
    } else {
      // Create new
      const { data: newLink, error: insertError } = await supabase
        .from('referral_links')
        .insert({
          app_id: appId,
          account_name: row.accountName || null,
          code: code,
          url: row.referralUrl,
          normalized_url: normalizedUrl,
          status: status,
          url_validation_status: validationStatus,
          is_active: isActive,
          notes: row.notes || null,
          owner_client_id: null,
          current_uses: 0
        })
        .select('id')
        .single();

      if (insertError) {
        console.error(`Error creating referral link:`, insertError);
        continue;
      }

      referralLinkId = newLink.id;
      console.log(`✓ Created referral link: ${row.referralUrl.substring(0, 50)}...`);
    }

    // If there's usage data, create usage record
    if (row.usedAt || row.customerName || row.usedBy) {
      let clientId: string | null = null;
      
      if (row.customerName) {
        const clientKey = row.customerName.toLowerCase().trim();
        clientId = clientMap.get(clientKey) || null;
        if (!clientId) {
          console.warn(`⚠️  Client not found: ${row.customerName}`);
        }
      }

      const redeemed = row.redeemed === 'true' || row.redeemed === true;
      const usedAt = row.usedAt ? new Date(row.usedAt).toISOString() : new Date().toISOString();

      referralUsages.push({
        referral_link_id: referralLinkId,
        appName: row.appName,
        accountName: row.accountName,
        customerName: row.customerName,
        client_id: clientId,
        used_at: usedAt,
        used_by: row.usedBy || null,
        redeemed: redeemed,
        notes: row.notes || null
      });
    }
  }

  // Insert usages
  if (referralUsages.length > 0) {
    console.log(`\nInserting ${referralUsages.length} usage records...`);
    
    const usageRecords = referralUsages.map(u => ({
      referral_link_id: u.referral_link_id,
      client_id: u.client_id,
      used_at: u.used_at,
      used_by: u.used_by,
      redeemed: u.redeemed,
      notes: u.notes
    }));

    const { error: usageError } = await supabase
      .from('referral_link_usages')
      .insert(usageRecords);

    if (usageError) {
      console.error('Error inserting usages:', usageError);
    } else {
      console.log(`✓ Inserted ${referralUsages.length} usage records`);
    }
  }

  console.log('\n✅ Import completed!');
  console.log(`   - Processed ${records.length} referral links`);
  console.log(`   - Created/updated referral links`);
  console.log(`   - Added ${referralUsages.length} usage records`);
}

main().catch(console.error);


