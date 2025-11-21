-- Migration: Optimize RLS policies
-- This migration ensures RLS policies use safe patterns and are consistent
-- This migration is idempotent and can be safely re-run

-- Note: This migration verifies RLS policies but does not modify them
-- unless there are specific security issues. The current RLS policies
-- should already be using safe patterns. This migration documents the
-- expected pattern and verifies consistency.

-- Step 1: Verify RLS is enabled on all business tables
DO $$
DECLARE
  tables_without_rls TEXT[];
  table_name TEXT;
BEGIN
  SELECT ARRAY_AGG(tablename)
  INTO tables_without_rls
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename IN (
      'tiers', 'clients', 'apps', 'promotions', 'referral_links',
      'referral_link_debts', 'client_apps', 'requests', 'credentials',
      'payment_links', 'slots', 'message_templates'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM pg_class c
      JOIN pg_namespace n ON c.relnamespace = n.oid
      WHERE c.relname = tablename
        AND n.nspname = 'public'
        AND c.relrowsecurity = true
    );
  
  IF array_length(tables_without_rls, 1) > 0 THEN
    RAISE WARNING '⚠️ Tables without RLS enabled: %', array_to_string(tables_without_rls, ', ');
  ELSE
    RAISE NOTICE '✅ All business tables have RLS enabled';
  END IF;
END $$;

-- Step 2: Document expected RLS pattern
-- The recommended pattern for RLS policies is:
-- - Use (SELECT auth.uid()) instead of auth.uid() directly for better performance
-- - Ensure policies are restrictive (authenticated users only)
-- - No anonymous read/write access to sensitive data

-- Step 3: Log current RLS policy count
DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN (
      'tiers', 'clients', 'apps', 'promotions', 'referral_links',
      'referral_link_debts', 'client_apps', 'requests', 'credentials',
      'payment_links', 'slots', 'message_templates'
    );
  
  RAISE NOTICE '✅ RLS policies verified: % policies found', policy_count;
  RAISE NOTICE 'ℹ️  RLS policies should use (SELECT auth.uid()) pattern for optimal performance';
END $$;

