/**
 * Set 7-day deadline for Sisal app bonuses
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

async function setSisalDeadline() {
  console.log('\n📅 Setting 7-day deadline for Sisal bonuses...\n');
  
  // Find Sisal app
  const { data: apps, error: findError } = await supabase
    .from('apps')
    .select('id, name, deadline_days')
    .ilike('name', 'sisal')
    .limit(1);
  
  if (findError) {
    console.error('Error finding Sisal app:', findError);
    process.exit(1);
  }
  
  if (!apps || apps.length === 0) {
    console.error('❌ Sisal app not found in database');
    console.log('\nAvailable apps:');
    const { data: allApps } = await supabase.from('apps').select('id, name').limit(20);
    allApps?.forEach(app => console.log(`  - ${app.name}`));
    process.exit(1);
  }
  
  const sisalApp = apps[0];
  console.log(`✓ Found Sisal app: ${sisalApp.name} (ID: ${sisalApp.id})`);
  console.log(`  Current deadline_days: ${sisalApp.deadline_days ?? 'null'}`);
  
  // Update deadline_days to 7 (one week)
  const { data: updatedApp, error: updateError } = await supabase
    .from('apps')
    .update({ deadline_days: 7 })
    .eq('id', sisalApp.id)
    .select()
    .single();
  
  if (updateError) {
    console.error('❌ Error updating Sisal app:', updateError);
    process.exit(1);
  }
  
  console.log(`\n✅ Successfully updated Sisal deadline_days to 7 days`);
  console.log(`   Updated app: ${updatedApp.name}`);
  
  // Update all existing client_apps for Sisal
  console.log('\n🔄 Updating deadlines for existing Sisal client_apps...');
  
  const { data: clientApps, error: clientAppsError } = await supabase
    .from('client_apps')
    .select('id, started_at, deadline_at')
    .eq('app_id', sisalApp.id);
  
  if (clientAppsError) {
    console.error('Error fetching client_apps:', clientAppsError);
  } else {
    console.log(`  Found ${clientApps?.length || 0} existing Sisal client_apps`);
    
    // The trigger should automatically recalculate deadlines, but let's verify
    // by calling the update function
    const { error: updateDeadlinesError } = await supabase.rpc('update_all_deadlines');
    
    if (updateDeadlinesError) {
      console.warn('⚠️  Warning: Could not update all deadlines:', updateDeadlinesError);
      console.log('   Deadlines will be recalculated automatically when client_apps are updated');
    } else {
      console.log('  ✓ All deadlines recalculated');
    }
    
    // Show some examples
    if (clientApps && clientApps.length > 0) {
      const withDeadlines = clientApps.filter(ca => ca.deadline_at);
      const withoutDeadlines = clientApps.filter(ca => !ca.deadline_at);
      
      console.log(`\n  Deadlines status:`);
      console.log(`    - With deadlines: ${withDeadlines.length}`);
      console.log(`    - Without deadlines: ${withoutDeadlines.length} (missing started_at)`);
      
      if (withDeadlines.length > 0) {
        console.log(`\n  Example deadlines:`);
        withDeadlines.slice(0, 3).forEach(ca => {
          const deadline = new Date(ca.deadline_at!);
          const started = ca.started_at ? new Date(ca.started_at) : null;
          const daysUntil = started 
            ? Math.ceil((deadline.getTime() - started.getTime()) / (1000 * 60 * 60 * 24))
            : 'N/A';
          console.log(`    - Started: ${started?.toLocaleDateString() || 'N/A'}, Deadline: ${deadline.toLocaleDateString()} (${daysUntil} days)`);
        });
      }
    }
  }
  
  console.log('\n✅ Sisal deadline configuration complete!');
  console.log('\n📝 What this means:');
  console.log('   - New Sisal client_apps will automatically get a 7-day deadline');
  console.log('   - Deadline = started_at + 7 days');
  console.log('   - Deadlines appear in the Deadlines page');
  console.log('   - You\'ll get alerts for overdue and due-soon deadlines');
}

setSisalDeadline()
  .then(() => {
    console.log('\n🎉 Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });

