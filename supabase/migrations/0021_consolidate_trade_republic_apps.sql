-- Migration: Consolidate "Trade Republic" and "TradeRepublic" into a single app
-- This migration merges these two apps which are the same but with different naming
-- Strategy: Keep the app with most relations (client_apps, promotions, referral_links, message_templates)
-- This migration is idempotent and can be safely re-run

-- Step 1: Identify which app to keep (the one with most relations)
-- "Trade Republic" has 55 client_apps, "TradeRepublic" has 0 client_apps but 1 promotion
-- We'll keep "Trade Republic" as it has more data
DO $$
DECLARE
  keep_app_id UUID;
  delete_app_id UUID;
BEGIN
  -- Find the app with most relations
  SELECT a.id INTO keep_app_id
  FROM apps a
  LEFT JOIN client_apps ca ON ca.app_id = a.id
  LEFT JOIN promotions p ON p.app_id = a.id
  LEFT JOIN referral_links rl ON rl.app_id = a.id
  LEFT JOIN message_templates mt ON mt.app_id = a.id
  WHERE LOWER(REPLACE(a.name, ' ', '')) = 'traderepublic'
  GROUP BY a.id, a.is_active
  ORDER BY 
    (COUNT(DISTINCT ca.id) + COUNT(DISTINCT p.id) + COUNT(DISTINCT rl.id) + COUNT(DISTINCT mt.id)) DESC,
    a.is_active DESC,
    a.name
  LIMIT 1;
  
  -- Find the other app to delete
  SELECT id INTO delete_app_id
  FROM apps
  WHERE LOWER(REPLACE(name, ' ', '')) = 'traderepublic'
    AND id != keep_app_id
  LIMIT 1;
  
  IF keep_app_id IS NULL OR delete_app_id IS NULL THEN
    RAISE NOTICE 'ℹ️  No Trade Republic duplicates found or already consolidated';
    RETURN;
  END IF;
  
  RAISE NOTICE 'ℹ️  Keeping app: % (id: %)', (SELECT name FROM apps WHERE id = keep_app_id), keep_app_id;
  RAISE NOTICE 'ℹ️  Deleting app: % (id: %)', (SELECT name FROM apps WHERE id = delete_app_id), delete_app_id;
  
  -- Step 2: Update client_apps to point to the kept app
  UPDATE client_apps
  SET app_id = keep_app_id
  WHERE app_id = delete_app_id;
  
  RAISE NOTICE '✅ Updated client_apps';
  
  -- Step 3: Update promotions to point to the kept app
  UPDATE promotions
  SET app_id = keep_app_id
  WHERE app_id = delete_app_id;
  
  RAISE NOTICE '✅ Updated promotions';
  
  -- Step 4: Update referral_links to point to the kept app
  UPDATE referral_links
  SET app_id = keep_app_id
  WHERE app_id = delete_app_id;
  
  RAISE NOTICE '✅ Updated referral_links';
  
  -- Step 5: Update message_templates to point to the kept app
  UPDATE message_templates
  SET app_id = keep_app_id
  WHERE app_id = delete_app_id;
  
  RAISE NOTICE '✅ Updated message_templates';
  
  -- Step 6: Delete the duplicate app FIRST (before renaming to avoid unique constraint violation)
  DELETE FROM apps
  WHERE id = delete_app_id;
  
  RAISE NOTICE '✅ Deleted duplicate app';
  
  -- Step 7: Normalize the name to "TradeRepublic" (no space, standard format)
  -- Now safe to rename since the duplicate is deleted
  UPDATE apps
  SET name = 'TradeRepublic'
  WHERE id = keep_app_id;
  
  RAISE NOTICE '✅ Normalized app name to "TradeRepublic"';
  
  RAISE NOTICE '✅ Deleted duplicate app';
  
  -- Step 8: Update is_active based on active promotions
  UPDATE apps a
  SET is_active = EXISTS (
    SELECT 1
    FROM promotions p
    WHERE p.app_id = a.id
      AND p.is_active = true
      AND (p.end_date IS NULL OR p.end_date >= CURRENT_DATE)
      AND (p.start_date IS NULL OR p.start_date <= CURRENT_DATE)
  )
  WHERE a.id = keep_app_id;
  
  RAISE NOTICE '✅ Updated is_active status';
  
  RAISE NOTICE '✅ Trade Republic apps consolidated successfully';
END $$;

-- Step 9: Verify consolidation
DO $$
DECLARE
  remaining_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining_count
  FROM apps
  WHERE LOWER(REPLACE(name, ' ', '')) = 'traderepublic';
  
  IF remaining_count = 1 THEN
    RAISE NOTICE '✅ Verification: Exactly 1 Trade Republic app remains';
  ELSE
    RAISE WARNING '⚠️  Verification: % Trade Republic apps found (expected 1)', remaining_count;
  END IF;
END $$;

