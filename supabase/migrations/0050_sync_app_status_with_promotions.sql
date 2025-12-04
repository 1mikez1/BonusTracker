-- Migration: Sync app is_active status with promotions
-- When a promotion's is_active changes, automatically update the associated app's is_active status
-- Logic: App is active if it has at least one active promotion

-- Step 1: Create function to sync app status based on promotions
CREATE OR REPLACE FUNCTION public.sync_app_status_from_promotions(p_app_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_active_promotion boolean;
  v_current_app_status boolean;
BEGIN
  -- Check if app has at least one active promotion
  SELECT EXISTS(
    SELECT 1 
    FROM public.promotions 
    WHERE app_id = p_app_id 
    AND is_active = true
  ) INTO v_has_active_promotion;
  
  -- Get current app status
  SELECT is_active INTO v_current_app_status
  FROM public.apps
  WHERE id = p_app_id;
  
  -- Only update if status needs to change
  IF v_has_active_promotion IS DISTINCT FROM v_current_app_status THEN
    UPDATE public.apps
    SET is_active = v_has_active_promotion
    WHERE id = p_app_id;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.sync_app_status_from_promotions(uuid) IS 
'Syncs app is_active status based on whether it has at least one active promotion. App is active if it has at least one active promotion.';

-- Step 2: Create trigger function to call sync when promotion is_active changes
CREATE OR REPLACE FUNCTION public.trigger_sync_app_on_promotion_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only sync if is_active changed or app_id changed
  IF (TG_OP = 'INSERT') THEN
    -- New promotion: sync the app
    IF NEW.app_id IS NOT NULL THEN
      PERFORM public.sync_app_status_from_promotions(NEW.app_id);
    END IF;
  ELSIF (TG_OP = 'UPDATE') THEN
    -- Promotion updated: sync if is_active or app_id changed
    IF (OLD.is_active IS DISTINCT FROM NEW.is_active) OR (OLD.app_id IS DISTINCT FROM NEW.app_id) THEN
      -- Sync new app if app_id changed
      IF NEW.app_id IS NOT NULL AND NEW.app_id IS DISTINCT FROM OLD.app_id THEN
        PERFORM public.sync_app_status_from_promotions(NEW.app_id);
      END IF;
      -- Sync old app if app_id changed
      IF OLD.app_id IS NOT NULL AND OLD.app_id IS DISTINCT FROM NEW.app_id THEN
        PERFORM public.sync_app_status_from_promotions(OLD.app_id);
      END IF;
      -- Sync current app if is_active changed
      IF NEW.app_id IS NOT NULL AND OLD.app_id = NEW.app_id THEN
        PERFORM public.sync_app_status_from_promotions(NEW.app_id);
      END IF;
    END IF;
  ELSIF (TG_OP = 'DELETE') THEN
    -- Promotion deleted: sync the app
    IF OLD.app_id IS NOT NULL THEN
      PERFORM public.sync_app_status_from_promotions(OLD.app_id);
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

COMMENT ON FUNCTION public.trigger_sync_app_on_promotion_change() IS 
'Trigger function to sync app is_active status when promotion is_active or app_id changes.';

-- Step 3: Create trigger on promotions table
DROP TRIGGER IF EXISTS trg_sync_app_on_promotion_change ON public.promotions;

CREATE TRIGGER trg_sync_app_on_promotion_change
AFTER INSERT OR UPDATE OF is_active, app_id OR DELETE ON public.promotions
FOR EACH ROW
EXECUTE FUNCTION public.trigger_sync_app_on_promotion_change();

-- Step 4: Backfill: sync all apps based on current promotions
DO $$
DECLARE
  app_record RECORD;
BEGIN
  FOR app_record IN SELECT id FROM public.apps
  LOOP
    PERFORM public.sync_app_status_from_promotions(app_record.id);
  END LOOP;
END $$;

