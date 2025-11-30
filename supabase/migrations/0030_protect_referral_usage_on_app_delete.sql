-- Migration: Auto-delete referral link usage when app process is deleted
-- When a client_app is deleted, the associated referral_link_usages record is also deleted
-- This makes the referral link return to "unused" status

-- Step 1: Keep SET NULL constraint to preserve manually created records
-- We'll use a trigger to explicitly delete usage when app is deleted
ALTER TABLE public.referral_link_usages
DROP CONSTRAINT IF EXISTS referral_link_usages_client_app_id_fkey;

ALTER TABLE public.referral_link_usages
ADD CONSTRAINT referral_link_usages_client_app_id_fkey
FOREIGN KEY (client_app_id)
REFERENCES public.client_apps(id)
ON DELETE SET NULL;

-- Step 2: Create function to delete usage when app is deleted
CREATE OR REPLACE FUNCTION public.delete_usage_on_app_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    -- When a client_app is deleted, delete the associated usage record
    DELETE FROM public.referral_link_usages
    WHERE client_app_id = OLD.id;
    
    RETURN OLD;
END;
$$;

-- Step 3: Create trigger to delete usage when app is deleted
DROP TRIGGER IF EXISTS trg_delete_usage_on_app_delete ON public.client_apps;
CREATE TRIGGER trg_delete_usage_on_app_delete
    AFTER DELETE ON public.client_apps
    FOR EACH ROW
    EXECUTE FUNCTION public.delete_usage_on_app_delete();

-- Step 4: Log migration completion
DO $$
BEGIN
    RAISE NOTICE '✅ Migration 0030 completed: Auto-delete referral usage on app delete';
    RAISE NOTICE '   - Created function: delete_usage_on_app_delete()';
    RAISE NOTICE '   - Created trigger: trg_delete_usage_on_app_delete on client_apps';
    RAISE NOTICE '   - Referral link usage records are now automatically deleted when app processes are deleted';
    RAISE NOTICE '   - Referral link statistics are automatically updated via existing trigger';
END $$;

