-- Cleanup misclassified message templates
-- This script removes templates that were incorrectly assigned to apps
-- when they should be in the Onboard (generic) section

-- Delete templates with step "Other" that contain Onboard content
-- These should be in Onboard (app_id = null), not assigned to specific apps
DELETE FROM public.message_templates
WHERE step = 'Other'
  AND app_id IS NOT NULL
  AND (
    LOWER(content) LIKE '%ciao, piacere%' OR
    LOWER(content) LIKE '%bonus di benvenuto%' OR
    LOWER(content) LIKE '%calendly.com/bonus-hunters%' OR
    LOWER(content) LIKE '%spiegazione + registrazione modulo%' OR
    LOWER(content) LIKE '%prenotazione fup%'
  );

-- Update any Onboard templates that were incorrectly assigned to apps
-- Move them to app_id = null
UPDATE public.message_templates
SET app_id = NULL
WHERE (
  LOWER(content) LIKE '%ciao, piacere%' OR
  LOWER(content) LIKE '%bonus di benvenuto%' OR
  LOWER(content) LIKE '%calendly.com/bonus-hunters%' OR
  LOWER(content) LIKE '%spiegazione + registrazione modulo%' OR
  LOWER(content) LIKE '%prenotazione fup%'
)
AND app_id IS NOT NULL
AND (
  step = 'Spiegazione + registrazione modulo' OR
  step = 'Spiegazione + registrazione modulo LIGHT' OR
  step = 'Prenotazione FUP' OR
  step = 'Other'
);

-- Add comment
COMMENT ON TABLE public.message_templates IS 'Message templates/guides for apps. Onboard templates (generic) have app_id = null. Structure: App (column 1) -> Step (column 2) -> Content (column 3).';

