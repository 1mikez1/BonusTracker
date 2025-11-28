-- Reset message_templates table - remove all data
-- This will allow a clean migration from CSV

-- Delete all message templates
TRUNCATE TABLE public.message_templates RESTART IDENTITY CASCADE;

-- Ensure unique constraint exists on (name, app_id) to prevent duplicates
-- This allows upsert to work correctly
DO $$
BEGIN
  -- Drop existing constraint if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'message_templates_name_app_id_key'
  ) THEN
    ALTER TABLE public.message_templates 
    DROP CONSTRAINT message_templates_name_app_id_key;
  END IF;
  
  -- Create unique constraint on (name, app_id)
  -- Note: This allows multiple templates with same name if app_id is different
  -- And allows multiple templates with NULL app_id if names are different
  CREATE UNIQUE INDEX IF NOT EXISTS message_templates_name_app_id_unique 
  ON public.message_templates(name, COALESCE(app_id::text, 'NULL'));
END $$;

-- Log the reset
DO $$
BEGIN
  RAISE NOTICE 'Message templates table has been reset. Ready for clean migration from CSV.';
  RAISE NOTICE 'Unique constraint on (name, app_id) has been ensured.';
END $$;

