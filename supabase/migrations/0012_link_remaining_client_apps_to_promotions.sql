-- Migration: Link remaining client_apps to promotions using case-insensitive app name matching
-- This migration is idempotent and can be safely re-run

-- Step 1: Link client_apps to promotions where promotion_id is NULL
-- Uses case-insensitive matching between app names
UPDATE client_apps ca
SET promotion_id = (
    SELECT p.id
    FROM promotions p
    JOIN apps a_promo ON p.app_id = a_promo.id
    JOIN apps a_client ON ca.app_id = a_client.id
    WHERE LOWER(TRIM(a_client.name)) = LOWER(TRIM(a_promo.name))
      AND p.is_active = true
      AND (p.end_date IS NULL OR p.end_date >= CURRENT_DATE)
      AND (p.start_date IS NULL OR p.start_date <= CURRENT_DATE)
    ORDER BY p.start_date DESC NULLS LAST, p.name ASC
    LIMIT 1
)
WHERE ca.promotion_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM promotions p_exist
    JOIN apps a_promo_exist ON p_exist.app_id = a_promo_exist.id
    JOIN apps a_client_exist ON ca.app_id = a_client_exist.id
    WHERE LOWER(TRIM(a_client_exist.name)) = LOWER(TRIM(a_promo_exist.name))
      AND p_exist.is_active = true
      AND (p_exist.end_date IS NULL OR p_exist.end_date >= CURRENT_DATE)
      AND (p_exist.start_date IS NULL OR p_exist.start_date <= CURRENT_DATE)
  );

-- Step 2: Update financial fields for completed/paid client_apps that now have promotion_id
-- Only update if profit_client, profit_us, or deposit_amount are NULL or 0
UPDATE client_apps ca
SET
    profit_client = COALESCE(NULLIF(ca.profit_client, 0), p.client_reward, 0),
    profit_us = COALESCE(NULLIF(ca.profit_us, 0), p.our_reward, 0),
    deposit_amount = COALESCE(NULLIF(ca.deposit_amount, 0), p.deposit_required, 0)
FROM promotions p
WHERE ca.promotion_id = p.id
  AND ca.status IN ('completed', 'paid')
  AND (
    ca.profit_client IS NULL OR ca.profit_client = 0 OR
    ca.profit_us IS NULL OR ca.profit_us = 0 OR
    ca.deposit_amount IS NULL OR ca.deposit_amount = 0
  );

-- Step 3: Log results
DO $$
DECLARE
  linked_count INTEGER;
  updated_profits_count INTEGER;
  remaining_unlinked INTEGER;
BEGIN
  -- Count how many were linked
  SELECT COUNT(*) INTO linked_count
  FROM client_apps
  WHERE promotion_id IS NOT NULL;
  
  -- Count how many had profits updated
  SELECT COUNT(*) INTO updated_profits_count
  FROM client_apps ca
  JOIN promotions p ON ca.promotion_id = p.id
  WHERE ca.status IN ('completed', 'paid')
    AND (
      ca.profit_client = p.client_reward OR
      ca.profit_us = p.our_reward OR
      ca.deposit_amount = p.deposit_required
    );
  
  -- Count remaining unlinked
  SELECT COUNT(*) INTO remaining_unlinked
  FROM client_apps
  WHERE promotion_id IS NULL;
  
  RAISE NOTICE '✅ Migration completed:';
  RAISE NOTICE '   - Client apps with promotion_id: %', linked_count;
  RAISE NOTICE '   - Client apps with updated profits: %', updated_profits_count;
  RAISE NOTICE '   - Remaining unlinked client_apps: %', remaining_unlinked;
END $$;

