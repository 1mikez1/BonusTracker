/**
 * Check most recent Sisal client_apps
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

async function checkRecent() {
  const { data: sisal } = await supabase
    .from('apps')
    .select('id, name, deadline_days')
    .ilike('name', 'sisal')
    .single();
  
  if (!sisal) {
    console.error('Sisal app not found');
    process.exit(1);
  }
  
  const { data: recent } = await supabase
    .from('client_apps')
    .select('id, created_at, started_at, deadline_at, status, apps!inner(name, deadline_days), clients!client_apps_client_id_fkey(name, surname)')
    .eq('app_id', sisal.id)
    .order('created_at', { ascending: false })
    .limit(5);
  
  console.log(`\n📋 Most recent 5 Sisal client_apps:\n`);
  
  recent?.forEach((ca: any) => {
    const client = ca.clients;
    const clientName = client ? `${client.name} ${client.surname || ''}`.trim() : 'Unknown';
    const started = ca.started_at ? new Date(ca.started_at) : null;
    const deadline = ca.deadline_at ? new Date(ca.deadline_at) : null;
    const days = started && deadline 
      ? Math.ceil((deadline.getTime() - started.getTime()) / (1000 * 60 * 60 * 24))
      : null;
    
    console.log(`  Client: ${clientName}`);
    console.log(`    ID: ${ca.id.substring(0, 8)}...`);
    console.log(`    Status: ${ca.status}`);
    console.log(`    Created: ${new Date(ca.created_at).toLocaleString()}`);
    console.log(`    Started: ${started ? started.toLocaleString() : '❌ MISSING'}`);
    console.log(`    Deadline: ${deadline ? deadline.toLocaleString() : '❌ MISSING'}`);
    if (days !== null) {
      console.log(`    Days: ${days} (expected: ${ca.apps.deadline_days})`);
    }
    console.log('');
  });
  
  // Check if any are missing deadlines
  const missingDeadlines = recent?.filter((ca: any) => !ca.deadline_at) || [];
  if (missingDeadlines.length > 0) {
    console.log(`⚠️  ${missingDeadlines.length} recent client_app(s) missing deadlines\n`);
  } else {
    console.log(`✅ All recent client_apps have deadlines set\n`);
  }
}

checkRecent().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
