-- Cleanup duplicate and incorrect message_templates
-- This script removes duplicates and fixes misclassified templates

-- Step 1: Remove duplicate templates (same name and app_id)
-- Keep the one with the best step_order or first one found
DELETE FROM public.message_templates
WHERE id IN (
  SELECT id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY name, app_id 
             ORDER BY step_order NULLS LAST, id
           ) as rn
    FROM public.message_templates
  ) t
  WHERE t.rn > 1
);

-- Step 2: Remove templates with step "Other", "introduction", "intro" from specific apps
DELETE FROM public.message_templates
WHERE app_id IS NOT NULL
  AND (
    LOWER(step) = 'other' OR
    LOWER(step) = 'introduction' OR
    LOWER(step) = 'intro' OR
    LOWER(name) LIKE '%other%' OR
    LOWER(name) LIKE '%introduction%' OR
    LOWER(name) LIKE '%intro%'
  );

-- Step 3: Remove templates that are clearly Onboard but assigned to apps
DELETE FROM public.message_templates
WHERE app_id IS NOT NULL
  AND (
    LOWER(step) LIKE '%spiegazione%' OR
    LOWER(step) LIKE '%registrazione modulo%' OR
    LOWER(step) LIKE '%prenotazione fup%' OR
    LOWER(content) LIKE '%ciao, piacere%' OR
    LOWER(content) LIKE '%bonus di benvenuto%' OR
    LOWER(content) LIKE '%calendly.com/bonus-hunters%'
  );

-- Step 4: Fix Onboard templates - ensure they have app_id = NULL
UPDATE public.message_templates
SET app_id = NULL
WHERE (
  LOWER(step) LIKE '%spiegazione + registrazione modulo%' OR
  LOWER(step) LIKE '%prenotazione fup%'
)
AND app_id IS NOT NULL;

-- Step 5: Remove Onboard templates that are NOT the 3 specific ones
-- Keep only: "Spiegazione + registrazione modulo", "Spiegazione + registrazione modulo LIGHT", "Prenotazione FUP"
DELETE FROM public.message_templates
WHERE app_id IS NULL
  AND NOT (
    LOWER(step) LIKE '%spiegazione + registrazione modulo%' OR
    LOWER(step) LIKE '%prenotazione fup%'
  );

-- Step 6: Fix app_id for templates that have app name in name but app_id is null
-- Match by app name in template name
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

-- Step 7: Remove templates with empty or very short content
DELETE FROM public.message_templates
WHERE content IS NULL 
   OR LENGTH(TRIM(content)) < 10;

-- Step 8: Remove templates with empty step name (except Onboard which might not need step)
DELETE FROM public.message_templates
WHERE step IS NULL 
   OR TRIM(step) = ''
   AND app_id IS NOT NULL;

-- Step 9: Fix duplicate step names within same app - keep only the first one by step_order
DELETE FROM public.message_templates
WHERE id IN (
  SELECT id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY app_id, step 
             ORDER BY step_order NULLS LAST, id
           ) as rn
    FROM public.message_templates
    WHERE app_id IS NOT NULL
      AND step IS NOT NULL
  ) t
  WHERE t.rn > 1
);

-- Step 10: Log cleanup results
DO $$
DECLARE
  total_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_count FROM public.message_templates;
  RAISE NOTICE 'Total message templates after cleanup: %', total_count;
  
  SELECT COUNT(*) INTO total_count 
  FROM public.message_templates 
  WHERE app_id IS NULL;
  RAISE NOTICE 'Onboard templates: %', total_count;
  
  SELECT COUNT(*) INTO total_count 
  FROM public.message_templates 
  WHERE app_id IS NOT NULL;
  RAISE NOTICE 'App-specific templates: %', total_count;
END $$;

-- Add comment
COMMENT ON TABLE public.message_templates IS 'Message templates/guides for apps. Onboard templates (generic) have app_id = null and step like "Spiegazione + registrazione modulo", "Prenotazione FUP". App-specific templates have app_id set and step like "apertura conto", "acquisti", etc. Duplicates are removed based on (name, app_id) and (app_id, step) combinations.';

