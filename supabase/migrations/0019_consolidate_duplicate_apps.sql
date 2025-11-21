-- Migration: Consolidate duplicate apps (case-insensitive duplicates)
-- This migration merges duplicate apps with different case (e.g., "KRAKEN" vs "Kraken")
-- Strategy: Keep the app with is_active = true, or the one with most relations if both inactive
-- This migration is idempotent and can be safely re-run

-- Step 1: Create a function to determine which app to keep for each duplicate group
-- Strategy: Keep the app with most relations (client_apps, promotions, referral_links, message_templates)
-- This ensures we don't lose data. If tied, prefer the active one.
CREATE OR REPLACE FUNCTION public.get_app_to_keep(normalized_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  keep_app_id UUID;
BEGIN
  -- Keep the app with most relations, preferring active if tied
  SELECT a.id INTO keep_app_id
  FROM apps a
  LEFT JOIN client_apps ca ON ca.app_id = a.id
  LEFT JOIN promotions p ON p.app_id = a.id
  LEFT JOIN referral_links rl ON rl.app_id = a.id
  LEFT JOIN message_templates mt ON mt.app_id = a.id
  WHERE LOWER(a.name) = normalized_name
  GROUP BY a.id, a.is_active
  ORDER BY 
    (COUNT(DISTINCT ca.id) + COUNT(DISTINCT p.id) + COUNT(DISTINCT rl.id) + COUNT(DISTINCT mt.id)) DESC,
    a.is_active DESC,
    a.name
  LIMIT 1;
  
  RETURN keep_app_id;
END;
$$;

-- Step 2: Update client_apps to point to the kept app
UPDATE client_apps ca
SET app_id = (
  SELECT get_app_to_keep(LOWER(a.name))
  FROM apps a
  WHERE a.id = ca.app_id
)
WHERE EXISTS (
  SELECT 1
  FROM apps a1
  JOIN apps a2 ON LOWER(a1.name) = LOWER(a2.name) AND a1.id != a2.id
  WHERE a1.id = ca.app_id
);

-- Step 3: Update promotions to point to the kept app
UPDATE promotions p
SET app_id = (
  SELECT get_app_to_keep(LOWER(a.name))
  FROM apps a
  WHERE a.id = p.app_id
)
WHERE EXISTS (
  SELECT 1
  FROM apps a1
  JOIN apps a2 ON LOWER(a1.name) = LOWER(a2.name) AND a1.id != a2.id
  WHERE a1.id = p.app_id
);

-- Step 4: Update referral_links to point to the kept app
UPDATE referral_links rl
SET app_id = (
  SELECT get_app_to_keep(LOWER(a.name))
  FROM apps a
  WHERE a.id = rl.app_id
)
WHERE EXISTS (
  SELECT 1
  FROM apps a1
  JOIN apps a2 ON LOWER(a1.name) = LOWER(a2.name) AND a1.id != a2.id
  WHERE a1.id = rl.app_id
);

-- Step 5: Update message_templates to point to the kept app
UPDATE message_templates mt
SET app_id = (
  SELECT get_app_to_keep(LOWER(a.name))
  FROM apps a
  WHERE a.id = mt.app_id
)
WHERE EXISTS (
  SELECT 1
  FROM apps a1
  JOIN apps a2 ON LOWER(a1.name) = LOWER(a2.name) AND a1.id != a2.id
  WHERE a1.id = mt.app_id
);

-- Step 6: Normalize app names to standard case (Title Case for most, keep acronyms uppercase)
-- Standardize to Title Case, except for known acronyms
UPDATE apps
SET name = CASE
  WHEN LOWER(name) = 'kraken' THEN 'Kraken'
  WHEN LOWER(name) = 'revolut' THEN 'Revolut'
  WHEN LOWER(name) = 'buddybank' THEN 'Buddybank'
  WHEN LOWER(name) = 'sisal' THEN 'Sisal'
  WHEN LOWER(name) = 'tinaba' THEN 'Tinaba'
  WHEN LOWER(name) = 'trading212' THEN 'Trading212'
  WHEN LOWER(name) = 'pokerstars' THEN 'Pokerstars'
  WHEN LOWER(name) = 'isybank' THEN 'Isybank'
  WHEN LOWER(name) = 'bybit' THEN 'Bybit'
  WHEN LOWER(name) = 'bunq' THEN 'Bunq'
  WHEN LOWER(name) = 'bbva' THEN 'BBVA'
  WHEN LOWER(name) = 'okx' THEN 'OKX'
  ELSE INITCAP(LOWER(name))
END
WHERE id IN (
  SELECT get_app_to_keep(LOWER(name))
  FROM apps
  GROUP BY LOWER(name)
  HAVING COUNT(*) > 1
);

-- Step 7: Update is_active for kept apps based on active promotions
-- If the kept app now has an active promotion, it should be active
UPDATE apps a
SET is_active = EXISTS (
  SELECT 1
  FROM promotions p
  WHERE p.app_id = a.id
    AND p.is_active = true
    AND (p.end_date IS NULL OR p.end_date >= CURRENT_DATE)
    AND (p.start_date IS NULL OR p.start_date <= CURRENT_DATE)
)
WHERE a.id IN (
  SELECT get_app_to_keep(LOWER(name))
  FROM apps
  GROUP BY LOWER(name)
  HAVING COUNT(*) > 1
);

-- Step 8: Delete duplicate apps (those not kept)
DELETE FROM apps
WHERE id NOT IN (
  SELECT get_app_to_keep(LOWER(name))
  FROM apps
  GROUP BY LOWER(name)
  HAVING COUNT(*) > 1
)
AND EXISTS (
  SELECT 1
  FROM apps a2
  WHERE LOWER(a2.name) = LOWER(apps.name)
    AND a2.id != apps.id
    AND a2.id = get_app_to_keep(LOWER(apps.name))
);

-- Step 9: Add unique constraint on normalized name (case-insensitive) to prevent future duplicates
-- First, check if constraint already exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'apps_name_lowercase_unique'
  ) THEN
    -- Create a unique index on lowercased name
    CREATE UNIQUE INDEX apps_name_lowercase_unique 
    ON apps(LOWER(name));
    
    COMMENT ON INDEX apps_name_lowercase_unique IS 
    'Ensures no duplicate app names (case-insensitive)';
  END IF;
END $$;

-- Step 10: Clean up helper function (optional, can keep for future use)
-- DROP FUNCTION IF EXISTS public.get_app_to_keep(TEXT);

-- Step 11: Log results
DO $$
DECLARE
  remaining_duplicates INTEGER;
  total_apps INTEGER;
BEGIN
  -- Check for remaining duplicates
  SELECT COUNT(*) INTO remaining_duplicates
  FROM (
    SELECT LOWER(name) as normalized_name
    FROM apps
    GROUP BY LOWER(name)
    HAVING COUNT(*) > 1
  ) duplicates;
  
  SELECT COUNT(*) INTO total_apps FROM apps;
  
  IF remaining_duplicates > 0 THEN
    RAISE WARNING '⚠️ % duplicate app groups still remain after consolidation', remaining_duplicates;
  ELSE
    RAISE NOTICE '✅ All duplicate apps consolidated successfully';
  END IF;
  
  RAISE NOTICE 'ℹ️  Total apps after consolidation: %', total_apps;
END $$;

