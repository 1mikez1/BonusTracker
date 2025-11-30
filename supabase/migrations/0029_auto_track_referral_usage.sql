-- Migration: Auto-track referral link usage when app status changes to "registered"
-- Automatically creates a referral_link_usages record when a client_app with a referral_link_id
-- changes status to "registered"

-- Step 1: Create function to handle automatic referral link usage tracking
CREATE OR REPLACE FUNCTION public.auto_track_referral_usage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_existing_usage uuid;
BEGIN
    -- Only process when status changes to 'registered' and referral_link_id exists
    IF NEW.status = 'registered' 
       AND NEW.referral_link_id IS NOT NULL 
       AND (OLD.status IS NULL OR OLD.status != 'registered') THEN
        
        -- Check if usage already exists for this client_app_id to avoid duplicates
        SELECT id INTO v_existing_usage
        FROM public.referral_link_usages
        WHERE client_app_id = NEW.id
        LIMIT 1;
        
        -- Only insert if usage doesn't already exist
        IF v_existing_usage IS NULL THEN
            INSERT INTO public.referral_link_usages (
                referral_link_id,
                client_id,
                client_app_id,
                used_at,
                used_by,
                redeemed,
                notes,
                created_at
            ) VALUES (
                NEW.referral_link_id,
                NEW.client_id,
                NEW.id,
                COALESCE(NEW.started_at, NOW()),
                NULL, -- used_by can be set manually later if needed
                false,
                NULL,
                NOW()
            );
            
            RAISE NOTICE 'Auto-tracked referral link usage for client_app_id: %, referral_link_id: %', 
                         NEW.id, NEW.referral_link_id;
        ELSE
            RAISE NOTICE 'Referral link usage already exists for client_app_id: %, skipping', NEW.id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.auto_track_referral_usage() IS 
'Auto-creates referral_link_usages record when client_app status changes to "registered"';

-- Step 2: Create trigger on client_apps table
DROP TRIGGER IF EXISTS trg_auto_track_referral_usage ON public.client_apps;
CREATE TRIGGER trg_auto_track_referral_usage
    AFTER INSERT OR UPDATE OF status, referral_link_id ON public.client_apps
    FOR EACH ROW
    WHEN (NEW.status = 'registered' AND NEW.referral_link_id IS NOT NULL)
    EXECUTE FUNCTION public.auto_track_referral_usage();

-- Step 3: Backfill existing registered apps with referral links
-- This handles apps that are already in "registered" status
DO $$
DECLARE
    rec RECORD;
    v_existing_usage uuid;
BEGIN
    FOR rec IN 
        SELECT ca.id, ca.referral_link_id, ca.client_id, ca.started_at, a.name as app_name
        FROM public.client_apps ca
        LEFT JOIN public.apps a ON ca.app_id = a.id
        WHERE ca.status = 'registered' 
          AND ca.referral_link_id IS NOT NULL
    LOOP
        -- Check if usage already exists
        SELECT id INTO v_existing_usage
        FROM public.referral_link_usages
        WHERE client_app_id = rec.id
        LIMIT 1;
        
        -- Only insert if usage doesn't exist
        IF v_existing_usage IS NULL THEN
            INSERT INTO public.referral_link_usages (
                referral_link_id,
                client_id,
                client_app_id,
                used_at,
                used_by,
                redeemed,
                notes,
                created_at
            ) VALUES (
                rec.referral_link_id,
                rec.client_id,
                rec.id,
                COALESCE(rec.started_at, NOW()),
                NULL,
                false,
                NULL,
                NOW()
            );
            
            RAISE NOTICE 'Backfilled referral link usage for client_app_id: %', rec.id;
        END IF;
    END LOOP;
    
    RAISE NOTICE '✅ Backfill completed: Processed existing registered apps with referral links';
END $$;

-- Step 4: Log migration completion
DO $$
BEGIN
    RAISE NOTICE '✅ Migration 0029 completed: Auto-track referral link usage';
    RAISE NOTICE '   - Created function: auto_track_referral_usage()';
    RAISE NOTICE '   - Created trigger: trg_auto_track_referral_usage on client_apps';
    RAISE NOTICE '   - Backfilled existing registered apps with referral links';
END $$;

