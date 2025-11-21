-- Fix and optimize message_templates table structure for Guide app CSV migration
-- This ensures the table is properly structured to handle the hierarchical CSV format

-- Ensure all columns exist and have correct types
DO $$ 
BEGIN
    -- Add step column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'message_templates' 
        AND column_name = 'step'
    ) THEN
        ALTER TABLE public.message_templates ADD COLUMN step text;
    END IF;

    -- Add language column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'message_templates' 
        AND column_name = 'language'
    ) THEN
        ALTER TABLE public.message_templates ADD COLUMN language text;
    END IF;

    -- Ensure app_id can be null (for generic templates like "Onboard")
    ALTER TABLE public.message_templates ALTER COLUMN app_id DROP NOT NULL;
    
    -- Ensure content is not null
    ALTER TABLE public.message_templates ALTER COLUMN content SET NOT NULL;
    
    -- Ensure name is not null
    ALTER TABLE public.message_templates ALTER COLUMN name SET NOT NULL;
END $$;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_message_templates_app_id ON public.message_templates(app_id);
CREATE INDEX IF NOT EXISTS idx_message_templates_step ON public.message_templates(step);
CREATE INDEX IF NOT EXISTS idx_message_templates_language ON public.message_templates(language);
CREATE INDEX IF NOT EXISTS idx_message_templates_name ON public.message_templates(name);

-- Create a composite index for common queries (app + step)
CREATE INDEX IF NOT EXISTS idx_message_templates_app_step ON public.message_templates(app_id, step) 
WHERE app_id IS NOT NULL;

-- Add comment to table for documentation
COMMENT ON TABLE public.message_templates IS 'Message templates/guides for apps. Structure: App (column 1) -> Step (column 2) -> Content (column 3). Generic templates (Onboard) have app_id = null.';

COMMENT ON COLUMN public.message_templates.name IS 'Template name: "App - Step" for app-specific, or just "Step" for generic (Onboard)';
COMMENT ON COLUMN public.message_templates.app_id IS 'UUID of the app. NULL for generic templates like "Onboard"';
COMMENT ON COLUMN public.message_templates.step IS 'Step name from CSV column 2 (e.g., "apertura conto", "acquisti", "PRO")';
COMMENT ON COLUMN public.message_templates.content IS 'Full message content from CSV column 3';
COMMENT ON COLUMN public.message_templates.language IS 'Language code (default: "it" for Italian)';

