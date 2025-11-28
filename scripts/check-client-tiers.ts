/**
 * Check Client Tiers Status
 * Shows how many clients have tiers assigned
 */

import { createClient } from '@supabase/supabase-js';

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

async function checkTiers() {
  const { data: clients, error } = await supabase
    .from('clients')
    .select('id, name, surname, tier_id, tiers(name)');
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('\n📊 Client Tiers Status\n');
  console.log(`Total clients in database: ${clients?.length || 0}`);
  console.log(`Clients with tiers: ${clients?.filter(c => c.tier_id).length || 0}`);
  console.log(`Clients without tiers: ${clients?.filter(c => !c.tier_id).length || 0}`);
  
  console.log('\nTier distribution:');
  const tierCounts = new Map<string, number>();
  clients?.forEach(c => {
    const tierName = c.tiers ? (c.tiers as any).name : 'No tier';
    tierCounts.set(tierName, (tierCounts.get(tierName) || 0) + 1);
  });
  
  Array.from(tierCounts.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([tier, count]) => {
      console.log(`  - ${tier}: ${count}`);
    });
}

checkTiers()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });

