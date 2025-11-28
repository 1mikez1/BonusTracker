-- Migration: Remove duplicate indexes on message_templates
-- This migration removes redundant indexes that duplicate existing ones
-- This migration is idempotent and can be safely re-run

-- Step 1: Remove duplicate message_templates_app_id_idx (idx_message_templates_app_id already exists)
DROP INDEX IF EXISTS public.message_templates_app_id_idx;

-- Step 2: Remove duplicate message_templates_language_idx (idx_message_templates_language already exists)
DROP INDEX IF EXISTS public.message_templates_language_idx;

-- Step 3: Verify removal
DO $$
DECLARE
  remaining_duplicates INTEGER;
  rec RECORD;
BEGIN
  -- Check if duplicates still exist
  SELECT COUNT(*) INTO remaining_duplicates
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND tablename = 'message_templates'
    AND indexname IN ('message_templates_app_id_idx', 'message_templates_language_idx');
  
  IF remaining_duplicates > 0 THEN
    RAISE WARNING '⚠️ Some duplicate indexes may still exist';
  ELSE
    RAISE NOTICE '✅ Duplicate indexes removed successfully';
  END IF;
  
  -- Log remaining indexes on message_templates
  RAISE NOTICE 'ℹ️  Remaining indexes on message_templates:';
  FOR rec IN 
    SELECT indexname 
    FROM pg_indexes 
    WHERE schemaname = 'public' 
      AND tablename = 'message_templates'
    ORDER BY indexname
  LOOP
    RAISE NOTICE '   - %', rec.indexname;
  END LOOP;
END $$;

