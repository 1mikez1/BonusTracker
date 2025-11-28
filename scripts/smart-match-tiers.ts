/**
 * Smart Tier Matching with Fuzzy Logic
 * Uses AI-like pattern recognition to match names with common variations
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

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

// Enhanced normalization - removes accents, handles common variations
function normalizeName(name: string): string {
  if (!name) return '';
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD') // Decompose accented characters
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[.,\-_]/g, ' ') // Replace punctuation with space
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

// Calculate similarity between two strings (0-1)
function similarity(str1: string, str2: string): number {
  const s1 = normalizeName(str1);
  const s2 = normalizeName(str2);
  
  if (s1 === s2) return 1.0;
  if (s1.includes(s2) || s2.includes(s1)) return 0.9;
  
  // Levenshtein-like similarity
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  const editDistance = levenshteinDistance(s1, s2);
  return 1 - (editDistance / longer.length);
}

// Simple Levenshtein distance
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[str2.length][str1.length];
}

// Common name variations mapping
const nameVariations: { [key: string]: string[] } = {
  'nicolo': ['nicolas', 'nicola', 'nicolas'],
  'mattia': ['matteo', 'mattia'],
  'giovanni': ['gianni', 'giovanni'],
  'francesco': ['franco', 'francesco'],
  'alessandro': ['alex', 'alessandro'],
  'antonio': ['tony', 'antonio'],
  'michele': ['mike', 'michele'],
  'manuel': ['manu', 'manuel'],
  'marco': ['mark', 'marco'],
};

// Check if names are variations of each other
function areNameVariations(name1: string, name2: string): boolean {
  const n1 = normalizeName(name1);
  const n2 = normalizeName(name2);
  
  // Check direct variations
  for (const [base, variations] of Object.entries(nameVariations)) {
    if ((n1 === base || variations.includes(n1)) && 
        (n2 === base || variations.includes(n2))) {
      return true;
    }
  }
  
  return false;
}

// Smart client matching with multiple strategies
async function findClientSmart(csvName: string, csvSurname: string | null): Promise<{ id: string; confidence: number; method: string } | null> {
  const normalizedCsvName = normalizeName(csvName);
  const normalizedCsvSurname = csvSurname ? normalizeName(csvSurname) : '';
  const csvFullName = csvSurname ? `${csvName} ${csvSurname}` : csvName;
  
  // Get all clients from database
  const { data: allClients, error } = await supabase
    .from('clients')
    .select('id, name, surname');
  
  if (error || !allClients) {
    console.error('Error fetching clients:', error);
    return null;
  }
  
  let bestMatch: { id: string; confidence: number; method: string } | null = null;
  
  for (const client of allClients) {
    const clientName = normalizeName(client.name || '');
    const clientSurname = normalizeName(client.surname || '');
    const clientFullName = client.surname ? `${client.name} ${client.surname}` : client.name;
    
    // Strategy 1: Exact full name match
    if (normalizeName(clientFullName) === normalizeName(csvFullName)) {
      return { id: client.id, confidence: 1.0, method: 'exact_full' };
    }
    
    // Strategy 2: Exact name + surname match
    if (clientName === normalizedCsvName && 
        (!csvSurname || clientSurname === normalizedCsvSurname)) {
      if (!bestMatch || bestMatch.confidence < 0.95) {
        bestMatch = { id: client.id, confidence: 0.95, method: 'exact_name_surname' };
      }
    }
    
    // Strategy 3: Name variation + surname match
    if (areNameVariations(client.name, csvName) && 
        (!csvSurname || clientSurname === normalizedCsvSurname)) {
      if (!bestMatch || bestMatch.confidence < 0.9) {
        bestMatch = { id: client.id, confidence: 0.9, method: 'name_variation' };
      }
    }
    
    // Strategy 4: High similarity on full name
    const fullNameSim = similarity(clientFullName, csvFullName);
    if (fullNameSim > 0.85 && (!bestMatch || bestMatch.confidence < fullNameSim)) {
      bestMatch = { id: client.id, confidence: fullNameSim, method: 'fuzzy_full' };
    }
    
    // Strategy 5: Name matches + surname similarity
    if (clientName === normalizedCsvName && csvSurname) {
      const surnameSim = similarity(client.surname || '', csvSurname);
      if (surnameSim > 0.8 && (!bestMatch || bestMatch.confidence < surnameSim * 0.9)) {
        bestMatch = { id: client.id, confidence: surnameSim * 0.9, method: 'fuzzy_surname' };
      }
    }
    
    // Strategy 6: Partial match (one contains the other)
    const csvNormalized = normalizeName(csvFullName);
    const clientNormalized = normalizeName(clientFullName);
    if (csvNormalized.includes(clientNormalized) || clientNormalized.includes(csvNormalized)) {
      const partialSim = Math.min(csvNormalized.length, clientNormalized.length) / 
                         Math.max(csvNormalized.length, clientNormalized.length);
      if (partialSim > 0.7 && (!bestMatch || bestMatch.confidence < partialSim)) {
        bestMatch = { id: client.id, confidence: partialSim, method: 'partial' };
      }
    }
  }
  
  // Only return if confidence is high enough
  return bestMatch && bestMatch.confidence > 0.75 ? bestMatch : null;
}

async function smartMatchTiers() {
  console.log('\n🧠 Smart Tier Matching with AI-like Pattern Recognition\n');
  
  // Load tiers
  const { data: tiers } = await supabase.from('tiers').select('id, name');
  const tierMap = new Map<string, string>();
  for (const tier of tiers || []) {
    tierMap.set(tier.name, tier.id);
  }
  
  const TOP_TIER_ID = tierMap.get('TOP');
  if (!TOP_TIER_ID) {
    console.error('TOP tier not found in database');
    process.exit(1);
  }
  
  // Read CSV
  const possiblePaths = [
    path.join(process.cwd(), 'Data', 'New - BH', 'New - BH - TIER CLIENTI.csv'),
    path.join(process.cwd(), 'New - BH - TIER CLIENTI.csv'),
  ];
  
  let csvPath: string | null = null;
  for (const possiblePath of possiblePaths) {
    if (fs.existsSync(possiblePath)) {
      csvPath = possiblePath;
      break;
    }
  }
  
  if (!csvPath) {
    console.error('CSV file not found');
    process.exit(1);
  }
  
  const content = fs.readFileSync(csvPath, 'utf-8');
  const contentWithoutBOM = content.charCodeAt(0) === 0xFEFF ? content.slice(1) : content;
  const records = parse(contentWithoutBOM, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
    bom: true
  });
  
  // Process TOP tier clients
  console.log('🔍 Processing TOP tier clients...\n');
  const topClients: Array<{ name: string; surname: string | null; match: any }> = [];
  
  for (const record of records) {
    const clientNameRaw = record['TOP'];
    if (!clientNameRaw || clientNameRaw.trim() === '') continue;
    
    const nameParts = clientNameRaw.trim().split(/\s+/);
    const name = nameParts[0] || '';
    const surname = nameParts.slice(1).join(' ') || null;
    
    if (!name) continue;
    
    const match = await findClientSmart(name, surname);
    topClients.push({ name, surname, match });
    
    if (match) {
      console.log(`✓ ${name} ${surname || ''} → ${match.method} (${Math.round(match.confidence * 100)}%)`);
    } else {
      console.log(`✗ ${name} ${surname || ''} → No match found`);
    }
  }
  
  // Update matched clients
  console.log('\n📝 Updating matched clients...\n');
  let updated = 0;
  let alreadyHasTier = 0;
  
  for (const client of topClients) {
    if (!client.match) continue;
    
    // Check current tier
    const { data: currentClient } = await supabase
      .from('clients')
      .select('tier_id')
      .eq('id', client.match.id)
      .single();
    
    if (currentClient?.tier_id === TOP_TIER_ID) {
      alreadyHasTier++;
      continue;
    }
    
    const { error } = await supabase
      .from('clients')
      .update({ tier_id: TOP_TIER_ID })
      .eq('id', client.match.id);
    
    if (error) {
      console.error(`  ❌ Error updating ${client.name}:`, error);
    } else {
      updated++;
      console.log(`  ✓ Updated: ${client.name} ${client.surname || ''}`);
    }
  }
  
  // Summary
  console.log('\n📊 Summary:');
  console.log(`  Total TOP clients in CSV: ${topClients.length}`);
  console.log(`  Matched: ${topClients.filter(c => c.match).length}`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Already had TOP tier: ${alreadyHasTier}`);
  console.log(`  Not found: ${topClients.filter(c => !c.match).length}`);
  
  // Show unmatched
  const unmatched = topClients.filter(c => !c.match);
  if (unmatched.length > 0) {
    console.log('\n⚠️  Unmatched TOP tier clients:');
    unmatched.slice(0, 20).forEach(c => {
      console.log(`    - ${c.name} ${c.surname || ''}`);
    });
    if (unmatched.length > 20) {
      console.log(`    ... and ${unmatched.length - 20} more`);
    }
  }
  
  // Verify final count
  const { data: finalClients } = await supabase
    .from('clients')
    .select('id')
    .eq('tier_id', TOP_TIER_ID);
  
  console.log(`\n✅ Final TOP tier count: ${finalClients?.length || 0}`);
}

smartMatchTiers()
  .then(() => {
    console.log('\n🎉 Smart matching completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });

