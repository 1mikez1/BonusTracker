-- Migration: Automatically update client_apps when promotions change
-- This migration creates a trigger that propagates promotion changes to linked client_apps
-- This migration is idempotent and can be safely re-run

-- Step 1: Create trigger function to sync client_apps when promotions are updated
CREATE OR REPLACE FUNCTION public.sync_client_apps_on_promotion_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only update if client_reward, our_reward, or deposit_required changed
  IF (OLD.client_reward IS DISTINCT FROM NEW.client_reward) OR
     (OLD.our_reward IS DISTINCT FROM NEW.our_reward) OR
     (OLD.deposit_required IS DISTINCT FROM NEW.deposit_required) THEN
    
    -- Update all client_apps linked to this promotion
    -- Only update completed/paid client_apps, and only if values differ
    UPDATE client_apps ca
    SET
      profit_client = NEW.client_reward,
      profit_us = NEW.our_reward,
      deposit_amount = COALESCE(NULLIF(ca.deposit_amount, 0), NEW.deposit_required, 0)
    WHERE ca.promotion_id = NEW.id
      AND ca.status IN ('completed', 'paid')
      AND (
        ca.profit_client IS DISTINCT FROM NEW.client_reward OR
        ca.profit_us IS DISTINCT FROM NEW.our_reward OR
        (ca.deposit_amount IS NULL OR ca.deposit_amount = 0)
      );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Step 2: Create trigger on promotions table
DROP TRIGGER IF EXISTS trg_sync_client_apps_on_promotion_update ON public.promotions;

CREATE TRIGGER trg_sync_client_apps_on_promotion_update
AFTER UPDATE OF client_reward, our_reward, deposit_required ON public.promotions
FOR EACH ROW
EXECUTE FUNCTION public.sync_client_apps_on_promotion_update();

-- Step 3: Add comment
COMMENT ON FUNCTION public.sync_client_apps_on_promotion_update IS 
'Automatically updates profit_client, profit_us, and deposit_amount in client_apps when the linked promotion is updated. Only updates completed/paid client_apps.';

