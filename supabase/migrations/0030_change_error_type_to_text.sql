-- Migration: Change error_type from enum to text to support custom error types
-- This allows users to add custom error types beyond the predefined ones

-- Step 1: Alter the client_errors table to change error_type from enum to text
DO $$
BEGIN
    -- Check if the column exists and is of type error_type
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'client_errors' 
        AND column_name = 'error_type'
        AND udt_name = 'error_type'
    ) THEN
        -- Change the column type from enum to text
        ALTER TABLE public.client_errors 
        ALTER COLUMN error_type TYPE text USING error_type::text;
        
        -- Add a check constraint to ensure error_type is not empty
        ALTER TABLE public.client_errors 
        ADD CONSTRAINT client_errors_error_type_not_empty 
        CHECK (error_type IS NOT NULL AND trim(error_type) != '');
    END IF;
END $$;

-- Step 2: Update the unique constraint to work with text instead of enum
-- Drop and recreate the constraint to ensure it works with text type
DO $$
BEGIN
    -- Drop the old constraint if it exists
    ALTER TABLE public.client_errors 
    DROP CONSTRAINT IF EXISTS client_errors_unique;
    
    -- Recreate it (it should work the same with text)
    -- This ensures the constraint works properly with the new text type
    ALTER TABLE public.client_errors 
    ADD CONSTRAINT client_errors_unique 
    UNIQUE (client_id, client_app_id, error_type, resolved_at);
EXCEPTION
    WHEN duplicate_object THEN
        -- Constraint already exists, which is fine
        NULL;
END $$;

COMMENT ON COLUMN public.client_errors.error_type IS 
'Type of error. Can be a predefined type or a custom type entered by the user.';

