-- Migration: Add payout tracking system
-- Tracks expected payout dates and confirmation status for completed apps

-- Add payout_days to promotions (days to wait after completion before payout)
alter table public.promotions
  add column if not exists payout_days integer;

comment on column public.promotions.payout_days is 'Number of days to wait after app completion before bonus payout is expected (e.g., 30 for Buddybank)';

-- Add payout tracking fields to client_apps
alter table public.client_apps
  add column if not exists expected_payout_at timestamptz,
  add column if not exists payout_confirmed boolean not null default false,
  add column if not exists payout_confirmed_at timestamptz;

comment on column public.client_apps.expected_payout_at is 'Calculated date when bonus payout is expected (completed_at + payout_days)';
comment on column public.client_apps.payout_confirmed is 'Whether the bonus payout has been confirmed as received';
comment on column public.client_apps.payout_confirmed_at is 'Timestamp when payout was confirmed';

-- Create index for efficient queries on pending payouts
create index if not exists idx_client_apps_expected_payout_at
  on public.client_apps (expected_payout_at)
  where expected_payout_at is not null and payout_confirmed = false;

create index if not exists idx_client_apps_payout_confirmed
  on public.client_apps (payout_confirmed, expected_payout_at)
  where status = 'completed';

-- Function to calculate expected_payout_at
create or replace function public.calculate_expected_payout_at(
  p_completed_at timestamptz,
  p_payout_days integer
) returns timestamptz
language plpgsql immutable as $$
begin
  if p_completed_at is null or p_payout_days is null then
    return null;
  end if;
  return p_completed_at + (p_payout_days || ' days')::interval;
end;
$$;

-- Function to update expected_payout_at when completed_at changes
create or replace function public.update_expected_payout_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payout_days integer;
begin
  -- Only process if status is 'completed' and completed_at is set
  if NEW.status = 'completed' and NEW.completed_at is not null then
    -- Get payout_days from promotion, or from app if promotion doesn't have it
    select coalesce(
      (select payout_days from public.promotions where id = NEW.promotion_id),
      (select payout_days from public.apps where id = NEW.app_id)
    ) into v_payout_days;
    
    -- If payout_days is set, calculate expected_payout_at
    if v_payout_days is not null and v_payout_days > 0 then
      NEW.expected_payout_at := public.calculate_expected_payout_at(NEW.completed_at, v_payout_days);
    else
      NEW.expected_payout_at := null;
    end if;
  else
    -- Clear expected_payout_at if not completed
    NEW.expected_payout_at := null;
    NEW.payout_confirmed := false;
    NEW.payout_confirmed_at := null;
  end if;
  
  return NEW;
end;
$$;

-- Trigger to automatically calculate expected_payout_at
drop trigger if exists trg_update_expected_payout_at on public.client_apps;
create trigger trg_update_expected_payout_at
  before insert or update of status, completed_at, promotion_id, app_id on public.client_apps
  for each row
  execute function public.update_expected_payout_at();

-- Backfill expected_payout_at for existing completed apps
do $$
declare
  v_app_record record;
  v_payout_days integer;
begin
  for v_app_record in
    select ca.id, ca.completed_at, ca.promotion_id, ca.app_id
    from public.client_apps ca
    where ca.status = 'completed'
      and ca.completed_at is not null
      and ca.expected_payout_at is null
  loop
    -- Get payout_days from promotion or app
    select coalesce(
      (select payout_days from public.promotions where id = v_app_record.promotion_id),
      (select payout_days from public.apps where id = v_app_record.app_id)
    ) into v_payout_days;
    
    -- Update if payout_days is available
    if v_payout_days is not null and v_payout_days > 0 then
      update public.client_apps
      set expected_payout_at = public.calculate_expected_payout_at(v_app_record.completed_at, v_payout_days)
      where id = v_app_record.id;
    end if;
  end loop;
end $$;

-- Add payout_days to apps table as well (for app-level defaults)
alter table public.apps
  add column if not exists payout_days integer;

comment on column public.apps.payout_days is 'Default number of days to wait after app completion before bonus payout (can be overridden by promotion.payout_days)';

