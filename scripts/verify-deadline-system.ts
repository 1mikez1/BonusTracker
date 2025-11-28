/**
 * Verify deadline system is properly set up
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

async function verifyDeadlineSystem() {
  console.log('\n🔍 Verifying Deadline System Setup...\n');
  
  let allGood = true;
  
  // 1. Check apps table has deadline_days column
  console.log('1️⃣ Checking apps table...');
  try {
    const { data: apps, error } = await supabase
      .from('apps')
      .select('id, name, deadline_days')
      .limit(5);
    
    if (error) {
      if (error.message.includes('deadline_days')) {
        console.log('  ❌ deadline_days column does not exist in apps table');
        console.log('     Run migration: supabase/migrations/0026_add_deadline_tracking.sql');
        allGood = false;
      } else {
        throw error;
      }
    } else {
      console.log('  ✅ apps.deadline_days column exists');
      if (apps && apps.length > 0) {
        const withDeadline = apps.filter(a => a.deadline_days && a.deadline_days > 0);
        console.log(`     Apps with deadlines: ${withDeadline.length}/${apps.length}`);
        withDeadline.forEach(a => {
          console.log(`       - ${a.name}: ${a.deadline_days} days`);
        });
      }
    }
  } catch (error: any) {
    console.log('  ❌ Error:', error.message);
    allGood = false;
  }
  
  // 2. Check client_apps table has started_at column
  console.log('\n2️⃣ Checking client_apps.started_at column...');
  try {
    const { data: clientApps, error } = await supabase
      .from('client_apps')
      .select('id, started_at')
      .limit(1);
    
    if (error) {
      if (error.message.includes('started_at')) {
        console.log('  ❌ started_at column does not exist in client_apps table');
        console.log('     Run migration: supabase/migrations/0026_add_deadline_tracking.sql');
        allGood = false;
      } else {
        throw error;
      }
    } else {
      console.log('  ✅ client_apps.started_at column exists');
    }
  } catch (error: any) {
    console.log('  ❌ Error:', error.message);
    allGood = false;
  }
  
  // 3. Check client_apps table has deadline_at column
  console.log('\n3️⃣ Checking client_apps.deadline_at column...');
  try {
    const { data: clientApps, error } = await supabase
      .from('client_apps')
      .select('id, deadline_at')
      .limit(1);
    
    if (error) {
      if (error.message.includes('deadline_at')) {
        console.log('  ❌ deadline_at column does not exist in client_apps table');
        console.log('     Run migration: supabase/migrations/0026_add_deadline_tracking.sql');
        allGood = false;
      } else {
        throw error;
      }
    } else {
      console.log('  ✅ client_apps.deadline_at column exists');
      
      // Count how many have deadlines
      const { data: allClientApps } = await supabase
        .from('client_apps')
        .select('id, deadline_at');
      
      const withDeadlines = allClientApps?.filter(ca => ca.deadline_at) || [];
      console.log(`     Client apps with deadlines: ${withDeadlines.length}/${allClientApps?.length || 0}`);
    }
  } catch (error: any) {
    console.log('  ❌ Error:', error.message);
    allGood = false;
  }
  
  // 4. Check if calculate_client_app_deadline function exists
  console.log('\n4️⃣ Checking database functions...');
  try {
    const { data, error } = await supabase.rpc('calculate_client_app_deadline', {
      p_client_app_id: '00000000-0000-0000-0000-000000000000' // Dummy ID to test function exists
    });
    
    if (error) {
      if (error.message.includes('does not exist') || error.message.includes('function')) {
        console.log('  ❌ calculate_client_app_deadline function does not exist');
        console.log('     Run migration: supabase/migrations/0026_add_deadline_tracking.sql');
        allGood = false;
      } else {
        // Function exists (error is expected with dummy ID)
        console.log('  ✅ calculate_client_app_deadline function exists');
      }
    } else {
      console.log('  ✅ calculate_client_app_deadline function exists');
    }
  } catch (error: any) {
    // Function might exist but error on dummy ID - that's OK
    if (error.message.includes('does not exist')) {
      console.log('  ❌ calculate_client_app_deadline function does not exist');
      allGood = false;
    } else {
      console.log('  ✅ calculate_client_app_deadline function exists');
    }
  }
  
  // 5. Check Sisal app specifically
  console.log('\n5️⃣ Checking Sisal app configuration...');
  try {
    const { data: sisal, error } = await supabase
      .from('apps')
      .select('id, name, deadline_days')
      .ilike('name', 'sisal')
      .single();
    
    if (error) {
      console.log('  ❌ Sisal app not found:', error.message);
      allGood = false;
    } else {
      if (sisal.deadline_days === 7) {
        console.log(`  ✅ Sisal is configured with 7-day deadline`);
      } else {
        console.log(`  ⚠️  Sisal deadline_days is ${sisal.deadline_days}, should be 7`);
        console.log('     Run: npx tsx scripts/set-sisal-deadline.ts');
      }
    }
  } catch (error: any) {
    console.log('  ❌ Error:', error.message);
    allGood = false;
  }
  
  // 6. Test deadline calculation on a real client_app
  console.log('\n6️⃣ Testing deadline calculation...');
  try {
    // Get a Sisal client_app if exists
    const { data: sisal } = await supabase
      .from('apps')
      .select('id')
      .ilike('name', 'sisal')
      .single();
    
    if (sisal) {
      const { data: sisalClientApps } = await supabase
        .from('client_apps')
        .select('id, started_at, deadline_at, apps!inner(id, name, deadline_days)')
        .eq('app_id', sisal.id)
        .limit(3);
      
      if (sisalClientApps && sisalClientApps.length > 0) {
        console.log(`  Found ${sisalClientApps.length} Sisal client_app(s):`);
        sisalClientApps.forEach((ca: any) => {
          const app = ca.apps;
          const started = ca.started_at ? new Date(ca.started_at) : null;
          const deadline = ca.deadline_at ? new Date(ca.deadline_at) : null;
          
          if (started && deadline && app.deadline_days) {
            const daysDiff = Math.ceil((deadline.getTime() - started.getTime()) / (1000 * 60 * 60 * 24));
            if (daysDiff === app.deadline_days) {
              console.log(`    ✅ Client app ${ca.id.substring(0, 8)}...: ${daysDiff} days (correct)`);
            } else {
              console.log(`    ⚠️  Client app ${ca.id.substring(0, 8)}...: ${daysDiff} days (expected ${app.deadline_days})`);
            }
          } else {
            console.log(`    ⚠️  Client app ${ca.id.substring(0, 8)}...: Missing started_at or deadline_at`);
          }
        });
      } else {
        console.log('  ℹ️  No Sisal client_apps found to test');
      }
    }
  } catch (error: any) {
    console.log('  ⚠️  Could not test deadline calculation:', error.message);
  }
  
  // Summary
  console.log('\n' + '='.repeat(50));
  if (allGood) {
    console.log('✅ Deadline system is properly configured!');
    console.log('\n📝 Next steps:');
    console.log('   1. New Sisal client_apps will automatically get 7-day deadlines');
    console.log('   2. Deadlines will appear on the Deadlines page');
    console.log('   3. You\'ll see alerts for overdue and due-soon deadlines');
  } else {
    console.log('⚠️  Some issues found. Please review above and run missing migrations.');
  }
  console.log('='.repeat(50) + '\n');
}

verifyDeadlineSystem()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });

