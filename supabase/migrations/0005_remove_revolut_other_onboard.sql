-- Remove "Other" and "Onboard" templates from Revolut
-- This script deletes message templates for Revolut that have step "Other" 
-- or are incorrectly classified as Onboard templates

-- First, find and delete templates with step "Other" for Revolut
DELETE FROM public.message_templates
WHERE app_id IN (
  SELECT id FROM public.apps WHERE LOWER(name) = 'revolut'
)
AND (
  step = 'Other' OR
  step = 'Onboard' OR
  LOWER(step) = 'onboard' OR
  LOWER(name) LIKE '%revolut%other%' OR
  LOWER(name) LIKE '%revolut%onboard%'
);

-- Also delete any templates that contain Onboard content but are assigned to Revolut
DELETE FROM public.message_templates
WHERE app_id IN (
  SELECT id FROM public.apps WHERE LOWER(name) = 'revolut'
)
AND (
  LOWER(content) LIKE '%ciao, piacere%' OR
  LOWER(content) LIKE '%bonus di benvenuto%' OR
  LOWER(content) LIKE '%calendly.com/bonus-hunters%' OR
  LOWER(content) LIKE '%spiegazione + registrazione modulo%' OR
  LOWER(content) LIKE '%prenotazione fup%'
);

-- Log the cleanup
DO $$
DECLARE
  deleted_count INTEGER;
BEGIN
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % template(s) from Revolut (Other/Onboard)', deleted_count;
END $$;

