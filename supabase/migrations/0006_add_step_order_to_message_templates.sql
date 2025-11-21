-- Add step_order column to message_templates table
-- This column will track the order of steps within each app (1, 2, 3, ...)

-- Add step_order column if it doesn't exist
ALTER TABLE public.message_templates 
ADD COLUMN IF NOT EXISTS step_order integer;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_message_templates_app_step_order 
ON public.message_templates(app_id, step_order) 
WHERE app_id IS NOT NULL;

-- Create index for Onboard templates (app_id IS NULL)
CREATE INDEX IF NOT EXISTS idx_message_templates_onboard_step_order 
ON public.message_templates(step_order) 
WHERE app_id IS NULL;

-- Add comment
COMMENT ON COLUMN public.message_templates.step_order IS 'Order of the step within the app (1, 2, 3, ...). Lower numbers appear first.';

