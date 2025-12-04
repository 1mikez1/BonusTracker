-- Migration: Fix trigger to fire on completed_at updates
-- Ensure trigger fires when completed_at is updated

-- Drop and recreate trigger to include completed_at in the update columns
drop trigger if exists trg_update_expected_payout_at on public.client_apps;

create trigger trg_update_expected_payout_at
  before insert or update of status, completed_at, started_at, promotion_id, app_id on public.client_apps
  for each row
  execute function public.update_expected_payout_at();

