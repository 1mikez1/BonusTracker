-- Migration: Add auto-tier assignment function
-- This function automatically assigns a tier to a client based on business rules

CREATE OR REPLACE FUNCTION public.assign_auto_tier(p_client_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    assigned_tier_id uuid;
    client_record public.clients%ROWTYPE;
    tier_20iq_id uuid;
    tier_tier2_id uuid;
    tier_tier1_id uuid;
    tier_top_id uuid;
BEGIN
    -- Get client record
    SELECT * INTO client_record
    FROM public.clients
    WHERE id = p_client_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Client not found: %', p_client_id;
    END IF;

    -- If client already has a tier, don't override (unless explicitly requested)
    IF client_record.tier_id IS NOT NULL THEN
        RETURN client_record.tier_id;
    END IF;

    -- Get tier IDs
    SELECT id INTO tier_20iq_id FROM public.tiers WHERE name = '20IQ' LIMIT 1;
    SELECT id INTO tier_tier2_id FROM public.tiers WHERE name = 'Tier 2' LIMIT 1;
    SELECT id INTO tier_tier1_id FROM public.tiers WHERE name = 'Tier 1' LIMIT 1;
    SELECT id INTO tier_top_id FROM public.tiers WHERE name = 'TOP' LIMIT 1;

    -- Default tier assignment logic
    -- You can customize this based on your business rules
    
    -- Rule 1: If client is trusted, assign Tier 1
    IF client_record.trusted = true THEN
        assigned_tier_id := tier_tier1_id;
    -- Rule 2: If client has completed apps, check performance
    ELSIF EXISTS (
        SELECT 1 FROM public.client_apps
        WHERE client_id = p_client_id
        AND status IN ('completed', 'paid')
    ) THEN
        -- Check completion rate and performance
        DECLARE
            total_apps integer;
            completed_apps integer;
            completion_rate numeric;
        BEGIN
            SELECT COUNT(*) INTO total_apps
            FROM public.client_apps
            WHERE client_id = p_client_id;

            SELECT COUNT(*) INTO completed_apps
            FROM public.client_apps
            WHERE client_id = p_client_id
            AND status IN ('completed', 'paid');

            IF total_apps > 0 THEN
                completion_rate := (completed_apps::numeric / total_apps::numeric) * 100;
                
                -- High completion rate (>80%) and multiple apps -> Tier 1
                IF completion_rate >= 80 AND total_apps >= 3 THEN
                    assigned_tier_id := tier_tier1_id;
                -- Medium completion rate (50-80%) -> Tier 2
                ELSIF completion_rate >= 50 THEN
                    assigned_tier_id := tier_tier2_id;
                -- Low completion rate (<50%) -> 20IQ
                ELSE
                    assigned_tier_id := tier_20iq_id;
                END IF;
            ELSE
                -- No apps yet -> Tier 2 (default for new clients)
                assigned_tier_id := tier_tier2_id;
            END IF;
        END;
    -- Rule 3: New client with no history -> Tier 2 (default)
    ELSE
        assigned_tier_id := tier_tier2_id;
    END IF;

    -- Update client with assigned tier
    UPDATE public.clients
    SET tier_id = assigned_tier_id
    WHERE id = p_client_id;

    RETURN assigned_tier_id;
END;
$$;

COMMENT ON FUNCTION public.assign_auto_tier(uuid) IS 
'Auto-assigns a tier to a client based on business rules: trusted clients -> Tier 1, high completion rate -> Tier 1, medium -> Tier 2, low -> 20IQ, new clients -> Tier 2';

-- Test the function (optional, can be removed)
DO $$
DECLARE
    test_client_id uuid;
    assigned_tier uuid;
BEGIN
    -- This is just a syntax check, won't run unless there's a test client
    RAISE NOTICE 'Function assign_auto_tier created successfully';
END $$;

