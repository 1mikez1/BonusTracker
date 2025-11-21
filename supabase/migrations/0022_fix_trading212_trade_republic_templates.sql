-- Migration: Fix message templates incorrectly assigned to Trading212 that belong to TradeRepublic
-- This migration moves message templates from Trading212 to TradeRepublic based on content analysis
-- This migration is idempotent and can be safely re-run

-- Move templates that contain "Trade Republic" or "TradeRepublic" references
-- in name or content from Trading212 to TradeRepublic
UPDATE message_templates mt
SET app_id = (
  SELECT id FROM apps WHERE LOWER(REPLACE(name, ' ', '')) = 'traderepublic' LIMIT 1
)
WHERE mt.app_id = (
  SELECT id FROM apps WHERE LOWER(name) = 'trading212' LIMIT 1
)
AND (
  LOWER(mt.name) LIKE '%trade republic%' OR
  LOWER(mt.name) LIKE '%traderepublic%' OR
  LOWER(mt.content) LIKE '%trade republic%' OR
  LOWER(mt.content) LIKE '%traderepublic%'
);

-- Log results
DO $$
DECLARE
  trading212_count INTEGER;
  traderepublic_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO trading212_count
  FROM message_templates mt
  JOIN apps a ON mt.app_id = a.id
  WHERE LOWER(a.name) = 'trading212';
  
  SELECT COUNT(*) INTO traderepublic_count
  FROM message_templates mt
  JOIN apps a ON mt.app_id = a.id
  WHERE LOWER(REPLACE(a.name, ' ', '')) = 'traderepublic';
  
  RAISE NOTICE '📊 Final counts:';
  RAISE NOTICE '   Trading212: % templates', trading212_count;
  RAISE NOTICE '   TradeRepublic: % templates', traderepublic_count;
END $$;
