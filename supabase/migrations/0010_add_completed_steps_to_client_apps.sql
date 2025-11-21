-- Add completed_steps JSONB column to client_apps table
ALTER TABLE public.client_apps 
ADD COLUMN IF NOT EXISTS completed_steps JSONB DEFAULT '[]'::jsonb;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_client_apps_completed_steps ON public.client_apps USING GIN (completed_steps);

-- Migrate existing completed steps from notes to completed_steps column
UPDATE public.client_apps
SET completed_steps = (
  SELECT jsonb_agg(value)
  FROM jsonb_array_elements(
    CASE 
      WHEN notes ~ '\{"completedSteps":\[.*\]\}' THEN
        (regexp_match(notes, '\{"completedSteps":(\[.*?\])'))[1]::jsonb
      ELSE '[]'::jsonb
    END
  )
),
notes = regexp_replace(notes, '\s*\{.*"completedSteps".*?\}\s*', '', 'g')
WHERE notes ~ '\{"completedSteps":\[.*\]\}';

COMMENT ON COLUMN public.client_apps.completed_steps IS 'Array of completed step names as JSON array. Stored separately from notes for better data structure.';

