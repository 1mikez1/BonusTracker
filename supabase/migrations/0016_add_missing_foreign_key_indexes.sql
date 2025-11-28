-- Migration: Add missing indexes on foreign key columns
-- This migration adds indexes on foreign keys that are frequently used in queries
-- This migration is idempotent and can be safely re-run

-- Step 1: Add index on client_apps.invited_by_client_id
CREATE INDEX IF NOT EXISTS idx_client_apps_invited_by_client_id 
ON public.client_apps(invited_by_client_id)
WHERE invited_by_client_id IS NOT NULL;

-- Step 2: Add index on client_apps.promotion_id
CREATE INDEX IF NOT EXISTS idx_client_apps_promotion_id 
ON public.client_apps(promotion_id)
WHERE promotion_id IS NOT NULL;

-- Step 3: Add index on client_apps.referral_link_id
CREATE INDEX IF NOT EXISTS idx_client_apps_referral_link_id 
ON public.client_apps(referral_link_id)
WHERE referral_link_id IS NOT NULL;

-- Step 4: Add index on referral_link_debts.referral_link_id
CREATE INDEX IF NOT EXISTS idx_referral_link_debts_referral_link_id 
ON public.referral_link_debts(referral_link_id);

-- Step 5: Add index on requests.client_id
CREATE INDEX IF NOT EXISTS idx_requests_client_id 
ON public.requests(client_id)
WHERE client_id IS NOT NULL;

-- Step 6: Log results
DO $$
DECLARE
  indexes_created INTEGER;
BEGIN
  SELECT COUNT(*) INTO indexes_created
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND indexname IN (
      'idx_client_apps_invited_by_client_id',
      'idx_client_apps_promotion_id',
      'idx_client_apps_referral_link_id',
      'idx_referral_link_debts_referral_link_id',
      'idx_requests_client_id'
    );
  
  RAISE NOTICE '✅ Foreign key indexes created/verified: %', indexes_created;
END $$;

