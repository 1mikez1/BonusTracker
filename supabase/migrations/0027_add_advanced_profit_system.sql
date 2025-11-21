-- Migration: Add advanced profit system with overrides and history
-- This migration adds support for dynamic profits per client and profit change tracking

-- Step 1: Add fields to promotions table
DO $$
BEGIN
    -- Add base_profit_client (renamed from client_reward for clarity, but keep client_reward for backward compatibility)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'promotions' 
        AND column_name = 'base_profit_client'
    ) THEN
        ALTER TABLE public.promotions 
        ADD COLUMN base_profit_client numeric(12,2);
        
        COMMENT ON COLUMN public.promotions.base_profit_client IS 
        'Base profit for client (default). If NULL, uses client_reward.';
        
        -- Populate from existing client_reward
        UPDATE public.promotions
        SET base_profit_client = client_reward
        WHERE base_profit_client IS NULL;
    END IF;
END $$;

DO $$
BEGIN
    -- Add base_profit_owner (renamed from our_reward for clarity)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'promotions' 
        AND column_name = 'base_profit_owner'
    ) THEN
        ALTER TABLE public.promotions 
        ADD COLUMN base_profit_owner numeric(12,2);
        
        COMMENT ON COLUMN public.promotions.base_profit_owner IS 
        'Base profit for owner (default). If NULL, uses our_reward.';
        
        -- Populate from existing our_reward
        UPDATE public.promotions
        SET base_profit_owner = our_reward
        WHERE base_profit_owner IS NULL;
    END IF;
END $$;

DO $$
BEGIN
    -- Add dynamic_profit_allowed flag
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'promotions' 
        AND column_name = 'dynamic_profit_allowed'
    ) THEN
        ALTER TABLE public.promotions 
        ADD COLUMN dynamic_profit_allowed boolean NOT NULL DEFAULT false;
        
        COMMENT ON COLUMN public.promotions.dynamic_profit_allowed IS 
        'If true, allows per-client profit overrides (e.g., Revolut with variable profits).';
    END IF;
END $$;

DO $$
BEGIN
    -- Add detailed_conditions JSONB
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'promotions' 
        AND column_name = 'detailed_conditions'
    ) THEN
        ALTER TABLE public.promotions 
        ADD COLUMN detailed_conditions jsonb;
        
        COMMENT ON COLUMN public.promotions.detailed_conditions IS 
        'JSONB object with detailed profit conditions (e.g., tier-based, volume-based, time-based).';
    END IF;
END $$;

-- Step 2: Add fields to client_apps table
DO $$
BEGIN
    -- Add profit_client_overridden
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'client_apps' 
        AND column_name = 'profit_client_overridden'
    ) THEN
        ALTER TABLE public.client_apps 
        ADD COLUMN profit_client_overridden numeric(12,2);
        
        COMMENT ON COLUMN public.client_apps.profit_client_overridden IS 
        'Manual override for client profit. If set, takes precedence over base profit.';
    END IF;
END $$;

DO $$
BEGIN
    -- Add profit_owner_overridden (profit_us is already existing, this is for clarity)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'client_apps' 
        AND column_name = 'profit_owner_overridden'
    ) THEN
        ALTER TABLE public.client_apps 
        ADD COLUMN profit_owner_overridden numeric(12,2);
        
        COMMENT ON COLUMN public.client_apps.profit_owner_overridden IS 
        'Manual override for owner profit. If set, takes precedence over base profit.';
    END IF;
END $$;

DO $$
BEGIN
    -- Add profit_last_update timestamp
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'client_apps' 
        AND column_name = 'profit_last_update'
    ) THEN
        ALTER TABLE public.client_apps 
        ADD COLUMN profit_last_update timestamptz;
        
        COMMENT ON COLUMN public.client_apps.profit_last_update IS 
        'Timestamp of last profit update (manual or automatic).';
    END IF;
END $$;

DO $$
BEGIN
    -- Add changed_by (operator who made the change)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'client_apps' 
        AND column_name = 'changed_by'
    ) THEN
        ALTER TABLE public.client_apps 
        ADD COLUMN changed_by uuid REFERENCES auth.users(id);
        
        COMMENT ON COLUMN public.client_apps.changed_by IS 
        'UUID of the operator who last changed the profit (from auth.users).';
    END IF;
END $$;

-- Step 3: Create profit_changes table for audit log
CREATE TABLE IF NOT EXISTS public.profit_changes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_app_id uuid NOT NULL REFERENCES public.client_apps(id) ON DELETE CASCADE,
    profit_type text NOT NULL CHECK (profit_type IN ('client', 'owner', 'both')),
    old_client_profit numeric(12,2),
    new_client_profit numeric(12,2),
    old_owner_profit numeric(12,2),
    new_owner_profit numeric(12,2),
    changed_by uuid REFERENCES auth.users(id),
    change_reason text,
    metadata jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.profit_changes IS 
'Audit log of all profit changes (manual overrides and automatic updates).';

COMMENT ON COLUMN public.profit_changes.profit_type IS 
'Type of profit changed: client, owner, or both.';

COMMENT ON COLUMN public.profit_changes.change_reason IS 
'Reason for the change (e.g., "Manual override", "Tier-based adjustment", "Volume bonus").';

-- Step 4: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_profit_changes_client_app 
ON public.profit_changes(client_app_id);

CREATE INDEX IF NOT EXISTS idx_profit_changes_created_at 
ON public.profit_changes(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_profit_changes_changed_by 
ON public.profit_changes(changed_by) 
WHERE changed_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_client_apps_profit_overridden 
ON public.client_apps(profit_client_overridden, profit_owner_overridden) 
WHERE profit_client_overridden IS NOT NULL OR profit_owner_overridden IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_promotions_dynamic_profit 
ON public.promotions(dynamic_profit_allowed) 
WHERE dynamic_profit_allowed = true;

-- Step 5: Create function to get profit for a specific client
CREATE OR REPLACE FUNCTION public.get_profit_for_client(
    p_app_id uuid,
    p_client_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_client_app_id uuid;
    v_promotion_id uuid;
    v_base_client_profit numeric(12,2);
    v_base_owner_profit numeric(12,2);
    v_client_profit numeric(12,2);
    v_owner_profit numeric(12,2);
    v_client_overridden numeric(12,2);
    v_owner_overridden numeric(12,2);
    v_dynamic_allowed boolean;
    v_detailed_conditions jsonb;
    v_client_tier_id uuid;
    v_result jsonb;
BEGIN
    -- Find client_app for this app and client
    SELECT id, promotion_id
    INTO v_client_app_id, v_promotion_id
    FROM public.client_apps
    WHERE app_id = p_app_id
    AND client_id = p_client_id
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'error', 'Client app not found',
            'client_profit', null,
            'owner_profit', null
        );
    END IF;

    -- Get promotion base profits
    IF v_promotion_id IS NOT NULL THEN
        SELECT 
            COALESCE(base_profit_client, client_reward, 0),
            COALESCE(base_profit_owner, our_reward, 0),
            COALESCE(dynamic_profit_allowed, false),
            detailed_conditions
        INTO 
            v_base_client_profit,
            v_base_owner_profit,
            v_dynamic_allowed,
            v_detailed_conditions
        FROM public.promotions
        WHERE id = v_promotion_id;
    END IF;

    -- Get overridden profits from client_apps
    SELECT 
        profit_client_overridden,
        profit_owner_overridden
    INTO 
        v_client_overridden,
        v_owner_overridden
    FROM public.client_apps
    WHERE id = v_client_app_id;

    -- Determine final profits (override takes precedence)
    v_client_profit := COALESCE(v_client_overridden, v_base_client_profit, 0);
    v_owner_profit := COALESCE(v_owner_overridden, v_base_owner_profit, 0);

    -- Apply dynamic conditions if allowed and conditions exist
    IF v_dynamic_allowed = true AND v_detailed_conditions IS NOT NULL THEN
        -- Get client tier for tier-based conditions
        SELECT tier_id INTO v_client_tier_id
        FROM public.clients
        WHERE id = p_client_id;

        -- Example: Apply tier-based multiplier (customize based on your needs)
        -- This is a placeholder - customize based on your detailed_conditions structure
        IF v_detailed_conditions ? 'tier_multipliers' THEN
            DECLARE
                tier_multiplier numeric := 1.0;
            BEGIN
                -- Get multiplier for client's tier
                IF v_client_tier_id IS NOT NULL THEN
                    SELECT (v_detailed_conditions->'tier_multipliers'->>tier_id::text)::numeric
                    INTO tier_multiplier
                    FROM public.tiers
                    WHERE id = v_client_tier_id;
                    
                    IF tier_multiplier IS NULL THEN
                        tier_multiplier := 1.0;
                    END IF;
                END IF;

                -- Apply multiplier if no override
                IF v_client_overridden IS NULL THEN
                    v_client_profit := v_base_client_profit * tier_multiplier;
                END IF;
                IF v_owner_overridden IS NULL THEN
                    v_owner_profit := v_base_owner_profit * tier_multiplier;
                END IF;
            END;
        END IF;
    END IF;

    -- Build result
    v_result := jsonb_build_object(
        'client_app_id', v_client_app_id,
        'promotion_id', v_promotion_id,
        'base_client_profit', v_base_client_profit,
        'base_owner_profit', v_base_owner_profit,
        'client_profit', v_client_profit,
        'owner_profit', v_owner_profit,
        'client_overridden', v_client_overridden IS NOT NULL,
        'owner_overridden', v_owner_overridden IS NOT NULL,
        'dynamic_allowed', v_dynamic_allowed,
        'source', CASE 
            WHEN v_client_overridden IS NOT NULL OR v_owner_overridden IS NOT NULL THEN 'override'
            WHEN v_dynamic_allowed = true THEN 'dynamic'
            ELSE 'base'
        END
    );

    RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.get_profit_for_client(uuid, uuid) IS 
'Returns calculated profit for a specific client-app combination, considering overrides and dynamic conditions.';

-- Step 6: Create trigger function to log profit changes
CREATE OR REPLACE FUNCTION public.log_profit_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    profit_type text := 'both';
    old_client numeric(12,2);
    new_client numeric(12,2);
    old_owner numeric(12,2);
    new_owner numeric(12,2);
BEGIN
    -- Determine what changed
    old_client := COALESCE(OLD.profit_client_overridden, OLD.profit_client, 0);
    new_client := COALESCE(NEW.profit_client_overridden, NEW.profit_client, 0);
    old_owner := COALESCE(OLD.profit_owner_overridden, OLD.profit_us, 0);
    new_owner := COALESCE(NEW.profit_owner_overridden, NEW.profit_us, 0);

    -- Only log if there's an actual change
    IF (old_client IS DISTINCT FROM new_client) OR (old_owner IS DISTINCT FROM new_owner) THEN
        -- Determine profit type
        IF old_client IS DISTINCT FROM new_client AND old_owner IS DISTINCT FROM new_owner THEN
            profit_type := 'both';
        ELSIF old_client IS DISTINCT FROM new_client THEN
            profit_type := 'client';
        ELSE
            profit_type := 'owner';
        END IF;

        -- Insert log entry
        INSERT INTO public.profit_changes (
            client_app_id,
            profit_type,
            old_client_profit,
            new_client_profit,
            old_owner_profit,
            new_owner_profit,
            changed_by,
            change_reason,
            metadata
        ) VALUES (
            NEW.id,
            profit_type,
            old_client,
            new_client,
            old_owner,
            new_owner,
            NEW.changed_by,
            CASE 
                WHEN NEW.profit_client_overridden IS NOT NULL OR NEW.profit_owner_overridden IS NOT NULL 
                THEN 'Manual override'
                ELSE 'Automatic update'
            END,
            jsonb_build_object(
                'status', NEW.status,
                'promotion_id', NEW.promotion_id
            )
        );

        -- Update profit_last_update timestamp
        NEW.profit_last_update := now();
    END IF;

    RETURN NEW;
END;
$$;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS trg_log_profit_change ON public.client_apps;

-- Create trigger
CREATE TRIGGER trg_log_profit_change
    AFTER UPDATE OF profit_client_overridden, profit_owner_overridden, profit_client, profit_us ON public.client_apps
    FOR EACH ROW
    EXECUTE FUNCTION public.log_profit_change();

-- Step 7: Enable RLS on profit_changes
ALTER TABLE public.profit_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profit_changes authenticated full access"
    ON public.profit_changes
    FOR ALL
    USING (auth.uid() IS NOT NULL)
    WITH CHECK (auth.uid() IS NOT NULL);

-- Step 8: Log migration completion
DO $$
BEGIN
    RAISE NOTICE '✅ Migration 0027 completed: Added advanced profit system';
    RAISE NOTICE '   - promotions.base_profit_client (numeric)';
    RAISE NOTICE '   - promotions.base_profit_owner (numeric)';
    RAISE NOTICE '   - promotions.dynamic_profit_allowed (boolean)';
    RAISE NOTICE '   - promotions.detailed_conditions (jsonb)';
    RAISE NOTICE '   - client_apps.profit_client_overridden (numeric)';
    RAISE NOTICE '   - client_apps.profit_owner_overridden (numeric)';
    RAISE NOTICE '   - client_apps.profit_last_update (timestamptz)';
    RAISE NOTICE '   - client_apps.changed_by (uuid)';
    RAISE NOTICE '   - profit_changes table (audit log)';
    RAISE NOTICE '   - Function get_profit_for_client(app_id, client_id)';
    RAISE NOTICE '   - Trigger trg_log_profit_change (auto-logs changes)';
    RAISE NOTICE '   - Indexes created for performance';
END $$;

