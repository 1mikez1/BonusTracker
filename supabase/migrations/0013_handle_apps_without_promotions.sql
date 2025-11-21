-- Migration: Handle apps without active promotions
-- This migration marks apps as inactive if they have no active promotions
-- This migration is idempotent and can be safely re-run

-- Step 1: Mark apps as inactive if they have no active promotions
-- Business rule: Apps without active promotions should be marked as is_active = false
UPDATE apps
SET is_active = false
WHERE is_active = true
  AND NOT EXISTS (
    SELECT 1
    FROM promotions p
    WHERE p.app_id = apps.id
      AND p.is_active = true
      AND (p.end_date IS NULL OR p.end_date >= CURRENT_DATE)
      AND (p.start_date IS NULL OR p.start_date <= CURRENT_DATE)
  );

-- Step 2: Log results
DO $$
DECLARE
  inactive_apps_count INTEGER;
  active_apps_count INTEGER;
  apps_with_promotions_count INTEGER;
BEGIN
  -- Count inactive apps
  SELECT COUNT(*) INTO inactive_apps_count
  FROM apps
  WHERE is_active = false;
  
  -- Count active apps
  SELECT COUNT(*) INTO active_apps_count
  FROM apps
  WHERE is_active = true;
  
  -- Count apps with active promotions
  SELECT COUNT(DISTINCT a.id) INTO apps_with_promotions_count
  FROM apps a
  JOIN promotions p ON p.app_id = a.id
  WHERE p.is_active = true
    AND (p.end_date IS NULL OR p.end_date >= CURRENT_DATE)
    AND (p.start_date IS NULL OR p.start_date <= CURRENT_DATE);
  
  RAISE NOTICE '✅ Apps status updated:';
  RAISE NOTICE '   - Inactive apps (no promotions): %', inactive_apps_count;
  RAISE NOTICE '   - Active apps: %', active_apps_count;
  RAISE NOTICE '   - Apps with active promotions: %', apps_with_promotions_count;
  
  -- Warn if there's a mismatch
  IF active_apps_count != apps_with_promotions_count THEN
    RAISE WARNING '⚠️ Mismatch: % active apps but % apps with promotions', active_apps_count, apps_with_promotions_count;
  END IF;
END $$;

