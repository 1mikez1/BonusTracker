-- Fix apps is_active status based on active promotions
-- An app should be active only if it has at least one active promotion

UPDATE public.apps
SET is_active = false
WHERE id NOT IN (
  SELECT DISTINCT app_id
  FROM public.promotions
  WHERE is_active = true
    AND (end_date IS NULL OR end_date >= CURRENT_DATE)
    AND (start_date IS NULL OR start_date <= CURRENT_DATE)
);

-- Fix message_templates: remove templates with step "introduction" or "Introduction" from specific apps
DELETE FROM public.message_templates
WHERE app_id IS NOT NULL
  AND (
    LOWER(step) = 'introduction' OR
    LOWER(step) = 'intro' OR
    LOWER(name) LIKE '%introduction%' OR
    LOWER(name) LIKE '%intro%'
  );

-- Fix message_templates: ensure Onboard templates are only the generic ones
-- Move any templates that are incorrectly assigned to apps but should be Onboard
UPDATE public.message_templates
SET app_id = NULL
WHERE app_id IS NOT NULL
  AND (
    LOWER(step) LIKE '%spiegazione%' OR
    LOWER(step) LIKE '%registrazione modulo%' OR
    LOWER(step) LIKE '%prenotazione fup%' OR
    LOWER(content) LIKE '%ciao, piacere%' OR
    LOWER(content) LIKE '%bonus di benvenuto%' OR
    LOWER(content) LIKE '%calendly.com/bonus-hunters%'
  );

-- Fix message_templates: ensure app_id is set correctly for app-specific templates
-- If name contains app name but app_id is null, try to find and set the app_id
UPDATE public.message_templates mt
SET app_id = a.id
FROM public.apps a
WHERE mt.app_id IS NULL
  AND mt.name IS NOT NULL
  AND LOWER(mt.name) LIKE '%' || LOWER(a.name) || '%'
  AND LOWER(mt.name) NOT LIKE '%onboard%'
  AND LOWER(mt.step) NOT LIKE '%spiegazione%'
  AND LOWER(mt.step) NOT LIKE '%registrazione modulo%'
  AND LOWER(mt.step) NOT LIKE '%prenotazione fup%'
  AND LOWER(mt.content) NOT LIKE '%ciao, piacere%'
  AND LOWER(mt.content) NOT LIKE '%bonus di benvenuto%'
  AND LOWER(mt.content) NOT LIKE '%calendly.com/bonus-hunters%';

-- Add comment
COMMENT ON TABLE public.message_templates IS 'Message templates/guides for apps. Onboard templates (generic) have app_id = null and step like "Spiegazione + registrazione modulo", "Prenotazione FUP". App-specific templates have app_id set and step like "apertura conto", "acquisti", etc.';

