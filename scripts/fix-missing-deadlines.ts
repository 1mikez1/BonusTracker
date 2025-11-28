/**
 * Fix missing started_at and deadlines for recent client_apps
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

async function fixMissingDeadlines() {
  console.log('\n🔧 Fixing Missing Deadlines...\n');
  
  // Get Sisal app
  const { data: sisal } = await supabase
    .from('apps')
    .select('id, name, deadline_days')
    .ilike('name', 'sisal')
    .single();
  
  if (!sisal) {
    console.error('❌ Sisal app not found');
    process.exit(1);
  }
  
  // Find all Sisal client_apps missing started_at or deadline_at
  const { data: clientApps, error: fetchError } = await supabase
    .from('client_apps')
    .select('id, created_at, started_at, deadline_at, status')
    .eq('app_id', sisal.id)
    .or('started_at.is.null,deadline_at.is.null');
  
  if (fetchError) {
    console.error('❌ Error:', fetchError);
    process.exit(1);
  }
  
  console.log(`Found ${clientApps?.length || 0} Sisal client_apps missing started_at or deadline_at\n`);
  
  if (!clientApps || clientApps.length === 0) {
    console.log('✅ All Sisal client_apps have deadlines!');
    return;
  }
  
  let fixedStartedAt = 0;
  let fixedDeadlines = 0;
  
  for (const ca of clientApps) {
    // Fix missing started_at
    if (!ca.started_at && ca.created_at) {
      const { error: updateError } = await supabase
        .from('client_apps')
        .update({ started_at: ca.created_at })
        .eq('id', ca.id);
      
      if (updateError) {
        console.error(`  ❌ Error fixing started_at for ${ca.id.substring(0, 8)}...:`, updateError);
      } else {
        fixedStartedAt++;
        console.log(`  ✓ Set started_at for ${ca.id.substring(0, 8)}...`);
      }
    }
    
    // Calculate deadline if started_at exists but deadline_at is missing
    if (ca.started_at && !ca.deadline_at) {
      const { error: calcError } = await supabase.rpc('calculate_client_app_deadline', {
        p_client_app_id: ca.id
      });
      
      if (calcError) {
        console.error(`  ❌ Error calculating deadline for ${ca.id.substring(0, 8)}...:`, calcError);
      } else {
        fixedDeadlines++;
        console.log(`  ✓ Calculated deadline for ${ca.id.substring(0, 8)}...`);
      }
    }
  }
  
  console.log('\n📊 Summary:');
  console.log(`  - Fixed started_at: ${fixedStartedAt}`);
  console.log(`  - Fixed deadlines: ${fixedDeadlines}`);
  
  // Verify the most recent one
  console.log('\n🔍 Verifying most recent Sisal client_app...');
  const { data: recent } = await supabase
    .from('client_apps')
    .select('id, created_at, started_at, deadline_at, status')
    .eq('app_id', sisal.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (recent) {
    console.log(`  ID: ${recent.id.substring(0, 8)}...`);
    console.log(`  Created: ${new Date(recent.created_at).toLocaleString()}`);
    console.log(`  Started: ${recent.started_at ? new Date(recent.started_at).toLocaleString() : '❌ MISSING'}`);
    console.log(`  Deadline: ${recent.deadline_at ? new Date(recent.deadline_at).toLocaleString() : '❌ MISSING'}`);
    
    if (recent.started_at && recent.deadline_at) {
      const started = new Date(recent.started_at);
      const deadline = new Date(recent.deadline_at);
      const days = Math.ceil((deadline.getTime() - started.getTime()) / (1000 * 60 * 60 * 24));
      console.log(`  ✅ Deadline: ${days} days from start (correct!)`);
    }
  }
  
  console.log('\n✅ Done! The new Sisal app should now appear in the dashboard.\n');
}

fixMissingDeadlines()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });

