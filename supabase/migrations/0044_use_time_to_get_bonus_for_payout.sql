-- Migration: Use time_to_get_bonus field for payout calculation
-- Extracts days from time_to_get_bonus text field (e.g., "40 giorni" -> 40)

-- Function to extract days from time_to_get_bonus text
create or replace function public.extract_payout_days_from_text(
  p_time_to_get_bonus text
) returns integer
language plpgsql immutable as $$
declare
  v_days integer;
  v_match text;
begin
  if p_time_to_get_bonus is null or trim(p_time_to_get_bonus) = '' then
    return null;
  end if;
  
  -- Handle "subito" or "immediate" cases
  if lower(trim(p_time_to_get_bonus)) in ('subito', 'immediate', 'immediato', 'now') then
    return 0;
  end if;
  
  -- Extract first number from the text using regex
  -- Matches patterns like "40 giorni", "5 days", "2-5 giorni", "30", etc.
  v_match := substring(p_time_to_get_bonus from '(\d+)');
  
  if v_match is not null then
    v_days := v_match::integer;
    return v_days;
  end if;
  
  -- If no number found, return null
  return null;
end;
$$;

-- Update the function to use time_to_get_bonus instead of payout_days
create or replace function public.update_expected_payout_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payout_days integer;
  v_time_to_get_bonus text;
begin
  -- Only process if status is 'completed' and completed_at is set
  if NEW.status = 'completed' and NEW.completed_at is not null then
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

-- Backfill expected_payout_at for existing completed apps using time_to_get_bonus
do $$
declare
  v_app_record record;
  v_payout_days integer;
  v_time_to_get_bonus text;
begin
  for v_app_record in
    select ca.id, ca.completed_at, ca.promotion_id
    from public.client_apps ca
    where ca.status = 'completed'
      and ca.completed_at is not null
      and ca.expected_payout_at is null
      and ca.promotion_id is not null
  loop
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
        set expected_payout_at = public.calculate_expected_payout_at(v_app_record.completed_at, v_payout_days)
        where id = v_app_record.id;
      end if;
    end if;
  end loop;
end $$;

