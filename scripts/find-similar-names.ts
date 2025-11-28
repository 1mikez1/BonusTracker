/**
 * Find similar names in database for unmatched clients
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

function normalizeName(name: string): string {
  return name.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function similarity(str1: string, str2: string): number {
  const s1 = normalizeName(str1);
  const s2 = normalizeName(str2);
  if (s1 === s2) return 1.0;
  if (s1.includes(s2) || s2.includes(s1)) return 0.9;
  const longer = s1.length > s2.length ? s1 : s2;
  const editDistance = levenshteinDistance(s1, s2);
  return 1 - (editDistance / longer.length);
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= str2.length; i++) matrix[i] = [i];
  for (let j = 0; j <= str1.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      matrix[i][j] = str2.charAt(i - 1) === str1.charAt(j - 1)
        ? matrix[i - 1][j - 1]
        : Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
    }
  }
  return matrix[str2.length][str1.length];
}

const unmatched = [
  'Raffaele Ciotola', 'Nicolo Penso', 'Matteo De Giorgio', 'Elisa Meloni',
  'Calogero Puleo', 'Leonardo Perotto', 'Lorenzo Giacopetti', 'Simone Caucinio',
  'Ignazio Bennardo', 'Matteo Genga', 'Vincenzo De Marinis', 'Giovanni Ciccimarra',
  'Lorenzo Floridia', 'Mohammed Elkiddar', 'Valerio Ragone', 'Jasminder Singh',
  'Aurelio Striano', 'Luca Fiorentini', 'Antonio Manzella', 'Maria Teresa Bova'
];

async function findSimilar() {
  const { data: clients } = await supabase.from('clients').select('id, name, surname, tier_id');
  
  console.log('\n🔍 Searching for similar names...\n');
  
  for (const unmatchedName of unmatched) {
    const [name, ...surnameParts] = unmatchedName.split(' ');
    const surname = surnameParts.join(' ');
    const fullName = unmatchedName;
    
    const candidates: Array<{ client: any; score: number }> = [];
    
    for (const client of clients || []) {
      const clientFull = client.surname ? `${client.name} ${client.surname}` : client.name;
      const score = similarity(fullName, clientFull);
      
      if (score > 0.6) {
        candidates.push({ client, score });
      }
    }
    
    candidates.sort((a, b) => b.score - a.score);
    
    if (candidates.length > 0) {
      const best = candidates[0];
      console.log(`"${unmatchedName}" → "${best.client.name} ${best.client.surname || ''}" (${Math.round(best.score * 100)}%)`);
      if (candidates.length > 1) {
        console.log(`  Also similar: ${candidates.slice(1, 3).map(c => `"${c.client.name} ${c.client.surname || ''}" (${Math.round(c.score * 100)}%)`).join(', ')}`);
      }
    } else {
      console.log(`"${unmatchedName}" → No similar matches found`);
    }
  }
}

findSimilar().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });

