-- Migration: Populate tiers table with the 4 business tiers
-- This migration is idempotent and can be safely re-run

INSERT INTO tiers (name, priority, notes)
VALUES
  ('TOP', 1, 'Highest tier clients, ultra reliable, fast, high volume.'),
  ('Tier 1', 2, 'Very good clients, high reliability and speed.'),
  ('Tier 2', 3, 'Average clients, normal priority.'),
  ('20IQ', 4, 'Lowest priority clients (slow, unreliable, problematic).')
ON CONFLICT (name) 
DO UPDATE SET
  priority = EXCLUDED.priority,
  notes = EXCLUDED.notes;

-- Verify insertion
DO $$
DECLARE
  tier_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO tier_count FROM tiers;
  
  IF tier_count = 4 THEN
    RAISE NOTICE '✅ Tiers table populated successfully with 4 tiers';
  ELSE
    RAISE WARNING '⚠️ Expected 4 tiers, found %', tier_count;
  END IF;
END $$;

