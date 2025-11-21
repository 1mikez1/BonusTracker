-- Migration: Add deadline tracking for bonus deadlines
-- This migration adds deadline fields to apps and client_apps tables

-- Step 1: Add deadline_days to apps table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'apps' 
        AND column_name = 'deadline_days'
    ) THEN
        ALTER TABLE public.apps 
        ADD COLUMN deadline_days integer NOT NULL DEFAULT 0;
        
        COMMENT ON COLUMN public.apps.deadline_days IS 
        'Number of days from start to deadline for bonus completion. 0 = no deadline.';
    END IF;
END $$;

-- Step 2: Add started_at to client_apps (if not exists, use created_at as fallback)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'client_apps' 
        AND column_name = 'started_at'
    ) THEN
        ALTER TABLE public.client_apps 
        ADD COLUMN started_at timestamptz;
        
        COMMENT ON COLUMN public.client_apps.started_at IS 
        'When the client actually started the app process. Used for deadline calculation.';
        
        -- Populate started_at from created_at for existing records
        UPDATE public.client_apps
        SET started_at = created_at
        WHERE started_at IS NULL;
    END IF;
END $$;

-- Step 3: Add deadline_at to client_apps (auto-calculated)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'client_apps' 
        AND column_name = 'deadline_at'
    ) THEN
        ALTER TABLE public.client_apps 
        ADD COLUMN deadline_at timestamptz;
        
        COMMENT ON COLUMN public.client_apps.deadline_at IS 
        'Calculated deadline: started_at + app.deadline_days. NULL if no deadline.';
    END IF;
END $$;

-- Step 4: Create function to calculate and update deadline_at
CREATE OR REPLACE FUNCTION public.calculate_client_app_deadline(p_client_app_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_started_at timestamptz;
    v_deadline_days integer;
    v_deadline_at timestamptz;
BEGIN
    -- Get started_at and app deadline_days
    SELECT 
        ca.started_at,
        COALESCE(a.deadline_days, 0)
    INTO 
        v_started_at,
        v_deadline_days
    FROM public.client_apps ca
    JOIN public.apps a ON a.id = ca.app_id
    WHERE ca.id = p_client_app_id;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    -- Calculate deadline: started_at + deadline_days
    IF v_started_at IS NOT NULL AND v_deadline_days > 0 THEN
        v_deadline_at := v_started_at + (v_deadline_days || ' days')::interval;
    ELSE
        v_deadline_at := NULL;
    END IF;

    -- Update deadline_at
    UPDATE public.client_apps
    SET deadline_at = v_deadline_at
    WHERE id = p_client_app_id;

    RETURN v_deadline_at;
END;
$$;

COMMENT ON FUNCTION public.calculate_client_app_deadline(uuid) IS 
'Calculates and updates deadline_at for a client_app based on started_at + app.deadline_days';

-- Step 5: Create trigger to auto-calculate deadline when started_at or app changes
CREATE OR REPLACE FUNCTION public.trigger_calculate_deadline()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    -- Recalculate deadline when started_at changes or when app_id changes
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        -- Calculate deadline for this client_app
        PERFORM public.calculate_client_app_deadline(NEW.id);
    END IF;
    
    RETURN NEW;
END;
$$;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS trg_calculate_deadline ON public.client_apps;

-- Create trigger
CREATE TRIGGER trg_calculate_deadline
    AFTER INSERT OR UPDATE OF started_at, app_id ON public.client_apps
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_calculate_deadline();

-- Step 6: Create function to update all deadlines (for bulk updates)
CREATE OR REPLACE FUNCTION public.update_all_deadlines()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    updated_count integer := 0;
BEGIN
    -- Update all client_apps with calculated deadlines
    UPDATE public.client_apps ca
    SET deadline_at = (
        SELECT 
            CASE 
                WHEN ca.started_at IS NOT NULL AND a.deadline_days > 0 THEN
                    ca.started_at + (a.deadline_days || ' days')::interval
                ELSE NULL
            END
        FROM public.apps a
        WHERE a.id = ca.app_id
    )
    WHERE EXISTS (
        SELECT 1 FROM public.apps a
        WHERE a.id = ca.app_id
        AND a.deadline_days > 0
    );

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$;

COMMENT ON FUNCTION public.update_all_deadlines() IS 
'Updates deadline_at for all client_apps based on started_at + app.deadline_days';

-- Step 7: Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_client_apps_started_at 
ON public.client_apps(started_at) 
WHERE started_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_client_apps_deadline_at 
ON public.client_apps(deadline_at) 
WHERE deadline_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_client_apps_deadline_status 
ON public.client_apps(deadline_at, status) 
WHERE deadline_at IS NOT NULL;

-- Step 8: Initial calculation for existing records
DO $$
DECLARE
    updated_count integer;
BEGIN
    SELECT public.update_all_deadlines() INTO updated_count;
    RAISE NOTICE '✅ Calculated deadlines for % existing client_apps', updated_count;
END $$;

-- Step 9: Log migration completion
DO $$
BEGIN
    RAISE NOTICE '✅ Migration 0026 completed: Added deadline tracking';
    RAISE NOTICE '   - apps.deadline_days (integer, default 0)';
    RAISE NOTICE '   - client_apps.started_at (timestamptz)';
    RAISE NOTICE '   - client_apps.deadline_at (timestamptz, auto-calculated)';
    RAISE NOTICE '   - Function calculate_client_app_deadline()';
    RAISE NOTICE '   - Function update_all_deadlines()';
    RAISE NOTICE '   - Trigger trg_calculate_deadline (auto-updates on started_at/app_id change)';
    RAISE NOTICE '   - Indexes created for performance';
END $$;

