/**
 * Check recent Sisal client_apps and their deadline status
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

async function checkRecentSisalApps() {
  console.log('\n🔍 Checking Recent Sisal Client Apps...\n');
  
  // Get Sisal app ID
  const { data: sisal, error: sisalError } = await supabase
    .from('apps')
    .select('id, name, deadline_days')
    .ilike('name', 'sisal')
    .single();
  
  if (sisalError || !sisal) {
    console.error('❌ Sisal app not found');
    process.exit(1);
  }
  
  console.log(`✓ Sisal app: ${sisal.name} (ID: ${sisal.id.substring(0, 8)}...)`);
  console.log(`  Deadline days: ${sisal.deadline_days}\n`);
  
  // Get all Sisal client_apps, ordered by most recent
  const { data: clientApps, error } = await supabase
    .from('client_apps')
    .select(`
      id,
      app_id,
      client_id,
      status,
      created_at,
      started_at,
      deadline_at,
      apps!inner(id, name, deadline_days),
      clients!client_apps_client_id_fkey(id, name, surname)
    `)
    .eq('app_id', sisal.id)
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (error) {
    console.error('❌ Error fetching client_apps:', error);
    process.exit(1);
  }
  
  console.log(`📊 Found ${clientApps?.length || 0} recent Sisal client_apps:\n`);
  
  if (!clientApps || clientApps.length === 0) {
    console.log('  ⚠️  No Sisal client_apps found');
    return;
  }
  
  for (const ca of clientApps) {
    const app = (ca as any).apps;
    const client = (ca as any).clients;
    const clientName = `${client.name} ${client.surname || ''}`.trim();
    
    console.log(`📱 Client App ID: ${ca.id.substring(0, 8)}...`);
    console.log(`   Client: ${clientName}`);
    console.log(`   Status: ${ca.status}`);
    console.log(`   Created: ${new Date(ca.created_at).toLocaleString()}`);
    console.log(`   Started: ${ca.started_at ? new Date(ca.started_at).toLocaleString() : '❌ NOT SET'}`);
    console.log(`   Deadline: ${ca.deadline_at ? new Date(ca.deadline_at).toLocaleString() : '❌ NOT SET'}`);
    
    if (!ca.started_at) {
      console.log(`   ⚠️  Missing started_at - deadline cannot be calculated!`);
    } else if (!ca.deadline_at) {
      console.log(`   ⚠️  Missing deadline_at - will try to calculate...`);
      
      // Try to calculate deadline
      const { error: calcError } = await supabase.rpc('calculate_client_app_deadline', {
        p_client_app_id: ca.id
      });
      
      if (calcError) {
        console.log(`   ❌ Error calculating: ${calcError.message}`);
      } else {
        console.log(`   ✅ Deadline calculated!`);
        
        // Fetch updated record
        const { data: updated } = await supabase
          .from('client_apps')
          .select('deadline_at')
          .eq('id', ca.id)
          .single();
        
        if (updated?.deadline_at) {
          console.log(`   New deadline: ${new Date(updated.deadline_at).toLocaleString()}`);
        }
      }
    } else {
      const started = new Date(ca.started_at);
      const deadline = new Date(ca.deadline_at);
      const days = Math.ceil((deadline.getTime() - started.getTime()) / (1000 * 60 * 60 * 24));
      console.log(`   ✅ Deadline set: ${days} days from start`);
    }
    
    console.log('');
  }
  
  // Check what the deadlines page would see
  console.log('\n📋 What Deadlines Page Would Show:\n');
  
  const { data: withDeadlines } = await supabase
    .from('client_apps')
    .select(`
      id,
      deadline_at,
      status,
      apps!inner(name),
      clients!client_apps_client_id_fkey(name, surname)
    `)
    .eq('app_id', sisal.id)
    .not('deadline_at', 'is', null)
    .order('deadline_at', { ascending: true })
    .limit(5);
  
  if (withDeadlines && withDeadlines.length > 0) {
    console.log(`  ✅ ${withDeadlines.length} Sisal apps with deadlines (would appear on page):`);
    withDeadlines.forEach((ca: any) => {
      const client = ca.clients;
      const deadline = new Date(ca.deadline_at);
      const now = new Date();
      const daysUntil = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const status = daysUntil < 0 ? 'OVERDUE' : daysUntil <= 2 ? 'DUE SOON' : 'IN PROGRESS';
      console.log(`     - ${client.name} ${client.surname || ''}: ${deadline.toLocaleDateString()} (${daysUntil} days, ${status})`);
    });
  } else {
    console.log('  ⚠️  No Sisal apps with deadlines found (page would be empty)');
  }
}

checkRecentSisalApps()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });

