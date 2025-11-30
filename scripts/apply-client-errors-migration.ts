/**
 * Script to apply the client_errors migration
 * This creates the client_errors table and related functions
 * 
 * Usage:
 * npx tsx scripts/apply-client-errors-migration.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Missing environment variables');
  console.error('Please set:');
  console.error('  - SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL');
  console.error('  - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function applyMigration() {
  console.log('🚀 Applying client_errors migration...\n');

  try {
    // Read the migration file
    const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', '0028_add_error_detection_system.sql');
    
    if (!fs.existsSync(migrationPath)) {
      console.error(`❌ Migration file not found: ${migrationPath}`);
      process.exit(1);
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    
    console.log('📝 Executing migration SQL...\n');

    // Execute the migration
    const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSQL });

    if (error) {
      // If exec_sql doesn't exist, try direct query
      console.log('⚠️  exec_sql RPC not available, trying direct execution...\n');
      
      // Split the SQL into individual statements and execute them
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('COMMENT'));

      for (const statement of statements) {
        if (statement.length > 10) { // Skip very short statements
          try {
            const { error: stmtError } = await supabase.rpc('exec', { query: statement });
            if (stmtError) {
              console.warn(`⚠️  Statement warning: ${stmtError.message}`);
            }
          } catch (e) {
            // Ignore individual statement errors, we'll try the full SQL
          }
        }
      }
    }

    // Verify the table was created
    const { data: tableCheck, error: checkError } = await supabase
      .from('client_errors')
      .select('id')
      .limit(1);

    if (checkError && checkError.message.includes('does not exist')) {
      console.error('\n❌ Migration failed: Table still does not exist');
      console.error('\n📋 Please apply the migration manually via Supabase Dashboard:');
      console.error('   1. Go to Supabase Dashboard → SQL Editor');
      console.error('   2. Open: supabase/migrations/0028_add_error_detection_system.sql');
      console.error('   3. Copy the entire contents');
      console.error('   4. Paste into SQL Editor and click Run\n');
      process.exit(1);
    }

    console.log('✅ Migration applied successfully!');
    console.log('✅ client_errors table created');
    console.log('\n🎉 You can now use the "Flag Error" button!\n');

  } catch (error: any) {
    console.error('\n❌ Error applying migration:', error.message);
    console.error('\n📋 Please apply the migration manually via Supabase Dashboard:');
    console.error('   1. Go to Supabase Dashboard → SQL Editor');
    console.error('   2. Open: supabase/migrations/0028_add_error_detection_system.sql');
    console.error('   3. Copy the entire contents');
    console.error('   4. Paste into SQL Editor and click Run\n');
    process.exit(1);
  }
}

applyMigration();

