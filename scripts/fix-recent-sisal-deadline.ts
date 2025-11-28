/**
 * Fix deadline for the most recently created Sisal client_app
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

async function fixRecentSisal() {
  console.log('\n🔧 Fixing most recent Sisal client_app deadline...\n');
  
  // Get Sisal app
  const { data: sisal } = await supabase
    .from('apps')
    .select('id, name')
    .ilike('name', 'sisal')
    .single();
  
  if (!sisal) {
    console.error('❌ Sisal app not found');
    process.exit(1);
  }
  
  // Get most recent Sisal client_app without deadline
  const { data: recentApps, error } = await supabase
    .from('client_apps')
    .select('id, created_at, started_at, deadline_at, apps!inner(id, name, deadline_days)')
    .eq('app_id', sisal.id)
    .is('deadline_at', null)
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
  
  if (!recentApps || recentApps.length === 0) {
    console.log('✅ No Sisal client_apps without deadlines found');
    console.log('   All Sisal client_apps already have deadlines set!');
    process.exit(0);
  }
  
  console.log(`Found ${recentApps.length} Sisal client_app(s) without deadlines:\n`);
  
  for (const app of recentApps) {
    console.log(`  Fixing: ${app.id.substring(0, 8)}...`);
    console.log(`    Created: ${new Date(app.created_at).toLocaleString()}`);
    
    // Set started_at if missing
    if (!app.started_at) {
      const { error: updateError } = await supabase
        .from('client_apps')
        .update({ started_at: app.created_at })
        .eq('id', app.id);
      
      if (updateError) {
        console.error(`    ❌ Error setting started_at:`, updateError);
        continue;
      }
      console.log(`    ✓ Set started_at to created_at`);
    }
    
    // Calculate deadline
    const { error: calcError } = await supabase.rpc('calculate_client_app_deadline', {
      p_client_app_id: app.id
    });
    
    if (calcError) {
      console.error(`    ❌ Error calculating deadline:`, calcError);
    } else {
      // Verify it was set
      const { data: updated } = await supabase
        .from('client_apps')
        .select('deadline_at, started_at')
        .eq('id', app.id)
        .single();
      
      if (updated?.deadline_at) {
        const deadline = new Date(updated.deadline_at);
        const started = updated.started_at ? new Date(updated.started_at) : null;
        const days = started 
          ? Math.ceil((deadline.getTime() - started.getTime()) / (1000 * 60 * 60 * 24))
          : 'N/A';
        console.log(`    ✅ Deadline set: ${deadline.toLocaleDateString()} (${days} days)`);
      } else {
        console.log(`    ⚠️  Deadline not set (check app deadline_days)`);
      }
    }
    console.log('');
  }
  
  console.log('✅ Done! The Sisal client_app(s) should now appear in the Deadlines page.\n');
}

fixRecentSisal()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });

