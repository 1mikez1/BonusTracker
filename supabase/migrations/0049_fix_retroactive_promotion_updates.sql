-- Migration: Fix retroactive promotion updates
-- Prevent promotion changes from overwriting existing client_app profit values
-- This ensures historical data integrity

-- Step 1: Update the trigger function to NOT update existing profit values
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
    
    -- IMPORTANT: Only update client_apps that have NULL or 0 values
    -- DO NOT overwrite existing profit values to preserve historical data
    UPDATE client_apps ca
    SET
      profit_client = COALESCE(NULLIF(ca.profit_client, 0), NEW.client_reward, 0),
      profit_us = COALESCE(NULLIF(ca.profit_us, 0), NEW.our_reward, 0),
      deposit_amount = COALESCE(NULLIF(ca.deposit_amount, 0), NEW.deposit_required, 0)
    WHERE ca.promotion_id = NEW.id
      AND ca.status IN ('completed', 'paid')
      AND (
        -- Only update if profit values are NULL or 0 (not yet set)
        (ca.profit_client IS NULL OR ca.profit_client = 0) OR
        (ca.profit_us IS NULL OR ca.profit_us = 0) OR
        (ca.deposit_amount IS NULL OR ca.deposit_amount = 0)
      );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Step 2: Update comment to reflect the new behavior
COMMENT ON FUNCTION public.sync_client_apps_on_promotion_update IS 
'Updates profit_client, profit_us, and deposit_amount in client_apps when the linked promotion is updated. Only updates client_apps that have NULL or 0 values - does NOT overwrite existing profit values to preserve historical data integrity.';

