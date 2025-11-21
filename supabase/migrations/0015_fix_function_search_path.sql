-- Migration: Fix function search_path for security
-- This migration updates existing functions to use explicit search_path = public
-- This migration is idempotent and can be safely re-run

-- Step 1: Update insert_client_app_profits_from_promotion function
CREATE OR REPLACE FUNCTION public.insert_client_app_profits_from_promotion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only update if status is 'completed' or 'paid' and promotion_id exists
  IF NEW.status IN ('completed', 'paid') AND NEW.promotion_id IS NOT NULL THEN
    UPDATE client_apps ca
    SET 
      profit_client = COALESCE(ca.profit_client, p.client_reward, 0),
      profit_us = COALESCE(ca.profit_us, p.our_reward, 0),
      deposit_amount = COALESCE(ca.deposit_amount, p.deposit_required, 0)
    FROM promotions p
    WHERE ca.id = NEW.id
      AND ca.promotion_id = p.id
      AND (
        ca.profit_client IS NULL OR ca.profit_client = 0 OR
        ca.profit_us IS NULL OR ca.profit_us = 0 OR
        ca.deposit_amount IS NULL OR ca.deposit_amount = 0
      );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Step 2: Update update_client_app_profits_from_promotion function
CREATE OR REPLACE FUNCTION public.update_client_app_profits_from_promotion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only update if status is 'completed' or 'paid'
  IF NEW.status IN ('completed', 'paid') THEN
    -- If promotion_id exists, update profits from promotion
    IF NEW.promotion_id IS NOT NULL THEN
      UPDATE client_apps ca
      SET 
        profit_client = COALESCE(ca.profit_client, p.client_reward, 0),
        profit_us = COALESCE(ca.profit_us, p.our_reward, 0),
        deposit_amount = COALESCE(ca.deposit_amount, p.deposit_required, 0)
      FROM promotions p
      WHERE ca.id = NEW.id
        AND ca.promotion_id = p.id
        AND (
          ca.profit_client IS NULL OR ca.profit_client = 0 OR
          ca.profit_us IS NULL OR ca.profit_us = 0 OR
          ca.deposit_amount IS NULL OR ca.deposit_amount = 0
        );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Step 3: Add comments
COMMENT ON FUNCTION public.insert_client_app_profits_from_promotion IS 
'Sets profit_client, profit_us, and deposit_amount from linked promotion when a new client_app is inserted with completed/paid status. Uses SECURITY DEFINER and explicit search_path for security.';

COMMENT ON FUNCTION public.update_client_app_profits_from_promotion IS 
'Sets profit_client, profit_us, and deposit_amount from linked promotion when a client_app status is updated to completed/paid. Uses SECURITY DEFINER and explicit search_path for security.';

