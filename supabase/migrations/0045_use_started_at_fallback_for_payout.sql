-- Migration: Use started_at or created_at as fallback for completed_at in payout calculation
-- If completed_at is NULL, use started_at, then created_at as fallback

-- Update the function to use started_at or created_at as fallback
create or replace function public.update_expected_payout_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payout_days integer;
  v_time_to_get_bonus text;
  v_completion_date timestamptz;
begin
  -- Only process if status is 'completed'
  if NEW.status = 'completed' then
    -- Use completed_at, fallback to started_at, then created_at
    v_completion_date := coalesce(NEW.completed_at, NEW.started_at, NEW.created_at);
    
    -- Only proceed if we have a completion date
    if v_completion_date is not null then
      -- Get time_to_get_bonus from promotion
      select time_to_get_bonus into v_time_to_get_bonus
      from public.promotions
      where id = NEW.promotion_id;
      
      -- Extract days from time_to_get_bonus
      if v_time_to_get_bonus is not null then
        v_payout_days := public.extract_payout_days_from_text(v_time_to_get_bonus);
      end if;
      
      -- If payout_days is set, calculate expected_payout_at
      if v_payout_days is not null and v_payout_days >= 0 then
        NEW.expected_payout_at := public.calculate_expected_payout_at(v_completion_date, v_payout_days);
      else
        NEW.expected_payout_at := null;
      end if;
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

-- Backfill expected_payout_at for existing completed apps using fallback dates
do $$
declare
  v_app_record record;
  v_payout_days integer;
  v_time_to_get_bonus text;
  v_completion_date timestamptz;
begin
  for v_app_record in
    select ca.id, ca.completed_at, ca.started_at, ca.created_at, ca.promotion_id
    from public.client_apps ca
    where ca.status = 'completed'
      and ca.expected_payout_at is null
      and ca.promotion_id is not null
  loop
    -- Use completed_at, fallback to started_at, then created_at
    v_completion_date := coalesce(v_app_record.completed_at, v_app_record.started_at, v_app_record.created_at);
    
    if v_completion_date is not null then
      -- Get time_to_get_bonus from promotion
      select time_to_get_bonus into v_time_to_get_bonus
      from public.promotions
      where id = v_app_record.promotion_id;
      
      -- Extract days from time_to_get_bonus
      if v_time_to_get_bonus is not null then
        v_payout_days := public.extract_payout_days_from_text(v_time_to_get_bonus);
        
        -- Update if payout_days is available
        if v_payout_days is not null and v_payout_days >= 0 then
          update public.client_apps
          set expected_payout_at = public.calculate_expected_payout_at(v_completion_date, v_payout_days)
          where id = v_app_record.id;
        end if;
      end if;
    end if;
  end loop;
end $$;

