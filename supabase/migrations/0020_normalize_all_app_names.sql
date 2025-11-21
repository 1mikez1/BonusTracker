-- Migration: Normalize all app names to standard case
-- This migration normalizes app names after duplicate consolidation
-- This migration is idempotent and can be safely re-run

-- Normalize all app names to standard case (Title Case for most, keep acronyms uppercase)
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
  WHEN LOWER(name) = 'trade republic' THEN 'Trade Republic'
  WHEN LOWER(name) = 'traderepublic' THEN 'TradeRepublic'
  ELSE INITCAP(LOWER(name))
END
WHERE name != CASE
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
  WHEN LOWER(name) = 'trade republic' THEN 'Trade Republic'
  WHEN LOWER(name) = 'traderepublic' THEN 'TradeRepublic'
  ELSE INITCAP(LOWER(name))
END;

-- Update is_active for all apps based on active promotions
UPDATE apps a
SET is_active = EXISTS (
  SELECT 1
  FROM promotions p
  WHERE p.app_id = a.id
    AND p.is_active = true
    AND (p.end_date IS NULL OR p.end_date >= CURRENT_DATE)
    AND (p.start_date IS NULL OR p.start_date <= CURRENT_DATE)
);

-- Log results
DO $$
DECLARE
  normalized_count INTEGER;
  total_apps INTEGER;
BEGIN
  SELECT COUNT(*) INTO normalized_count
  FROM apps
  WHERE name = CASE
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
    WHEN LOWER(name) = 'trade republic' THEN 'Trade Republic'
    WHEN LOWER(name) = 'traderepublic' THEN 'TradeRepublic'
    ELSE INITCAP(LOWER(name))
  END;
  
  SELECT COUNT(*) INTO total_apps FROM apps;
  
  RAISE NOTICE '✅ App names normalized: % / %', normalized_count, total_apps;
END $$;

