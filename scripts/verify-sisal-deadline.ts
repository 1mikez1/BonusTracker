/**
 * Verify Sisal deadline configuration
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

async function verify() {
  console.log('\n📅 Verifying Sisal deadline configuration...\n');
  
  const { data: sisal, error } = await supabase
    .from('apps')
    .select('id, name, deadline_days')
    .ilike('name', 'sisal')
    .single();
  
  if (error || !sisal) {
    console.error('❌ Sisal app not found');
    process.exit(1);
  }
  
  console.log(`✓ Sisal app found: ${sisal.name}`);
  console.log(`  ID: ${sisal.id}`);
  console.log(`  Deadline Days: ${sisal.deadline_days ?? 'Not set'}`);
  
  if (sisal.deadline_days === 7) {
    console.log('\n✅ Sisal is configured with a 7-day deadline!');
    console.log('\n📝 How it works:');
    console.log('   - When a client starts a Sisal bonus, deadline = started_at + 7 days');
    console.log('   - Deadlines appear in the Deadlines page');
    console.log('   - You\'ll see alerts for overdue and due-soon deadlines');
  } else {
    console.log(`\n⚠️  Sisal deadline_days is ${sisal.deadline_days}, not 7`);
    console.log('   Run: npx tsx scripts/set-sisal-deadline.ts to set it to 7 days');
  }
}

verify().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });

