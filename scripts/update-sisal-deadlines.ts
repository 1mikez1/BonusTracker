/**
 * Update deadlines for all existing Sisal client_apps
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

async function updateSisalDeadlines() {
  console.log('\n🔄 Updating deadlines for all Sisal client_apps...\n');
  
  // Get Sisal app
  const { data: sisal, error: sisalError } = await supabase
    .from('apps')
    .select('id, name, deadline_days')
    .ilike('name', 'sisal')
    .single();
  
  if (sisalError || !sisal) {
    console.error('❌ Sisal app not found');
    process.exit(1);
  }
  
  console.log(`✓ Found Sisal app: ${sisal.name} (${sisal.deadline_days} days)`);
  
  // Get all Sisal client_apps
  const { data: clientApps, error: fetchError } = await supabase
    .from('client_apps')
    .select('id, started_at, deadline_at, created_at')
    .eq('app_id', sisal.id);
  
  if (fetchError) {
    console.error('❌ Error fetching client_apps:', fetchError);
    process.exit(1);
  }
  
  console.log(`\n📊 Found ${clientApps?.length || 0} Sisal client_apps\n`);
  
  let updated = 0;
  let alreadySet = 0;
  let needsStartedAt = 0;
  
  for (const ca of clientApps || []) {
    // If started_at is missing, set it to created_at
    if (!ca.started_at && ca.created_at) {
      const { error: updateError } = await supabase
        .from('client_apps')
        .update({ started_at: ca.created_at })
        .eq('id', ca.id);
      
      if (updateError) {
        console.error(`  ❌ Error updating started_at for ${ca.id}:`, updateError);
      } else {
        needsStartedAt++;
        console.log(`  ✓ Set started_at for ${ca.id.substring(0, 8)}...`);
      }
    }
    
    // Check if deadline is correct
    if (ca.started_at) {
      const expectedDeadline = new Date(ca.started_at);
      expectedDeadline.setDate(expectedDeadline.getDate() + (sisal.deadline_days || 7));
      
      const currentDeadline = ca.deadline_at ? new Date(ca.deadline_at) : null;
      
      if (!currentDeadline || 
          Math.abs(currentDeadline.getTime() - expectedDeadline.getTime()) > 1000) {
        // Deadline is missing or incorrect, trigger recalculation
        const { error: calcError } = await supabase.rpc('calculate_client_app_deadline', {
          p_client_app_id: ca.id
        });
        
        if (calcError) {
          console.error(`  ❌ Error calculating deadline for ${ca.id}:`, calcError);
        } else {
          updated++;
          console.log(`  ✓ Updated deadline for ${ca.id.substring(0, 8)}...`);
        }
      } else {
        alreadySet++;
      }
    }
  }
  
  // Use bulk update function as well
  console.log('\n🔄 Running bulk deadline update...');
  const { data: bulkResult, error: bulkError } = await supabase.rpc('update_all_deadlines');
  
  if (bulkError) {
    console.warn('  ⚠️  Bulk update error:', bulkError.message);
  } else {
    console.log(`  ✓ Bulk update completed`);
  }
  
  console.log('\n📊 Summary:');
  console.log(`  - Set started_at: ${needsStartedAt}`);
  console.log(`  - Updated deadlines: ${updated}`);
  console.log(`  - Already correct: ${alreadySet}`);
  console.log(`  - Total Sisal client_apps: ${clientApps?.length || 0}`);
  
  // Verify final state
  console.log('\n✅ Verification:');
  const { data: finalCheck } = await supabase
    .from('client_apps')
    .select('id, started_at, deadline_at')
    .eq('app_id', sisal.id)
    .not('deadline_at', 'is', null);
  
  console.log(`  - Client apps with deadlines: ${finalCheck?.length || 0}/${clientApps?.length || 0}`);
  
  if (finalCheck && finalCheck.length > 0) {
    const sample = finalCheck[0];
    if (sample.started_at && sample.deadline_at) {
      const started = new Date(sample.started_at);
      const deadline = new Date(sample.deadline_at);
      const days = Math.ceil((deadline.getTime() - started.getTime()) / (1000 * 60 * 60 * 24));
      console.log(`  - Sample deadline: ${days} days from start (correct!)`);
    }
  }
  
  console.log('\n🎉 All Sisal deadlines updated!\n');
}

updateSisalDeadlines()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });

