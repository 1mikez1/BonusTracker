-- Migration: Auto-assign partner when client is created with invited_by_client_id
-- If the inviting client is assigned to a partner, automatically assign the new client to the same partner

create or replace function public.auto_assign_partner_from_invited_by()
returns trigger
language plpgsql
security definer
as $$
declare
  inviter_partner_id uuid;
  inviter_split_partner numeric(5,4);
  inviter_split_owner numeric(5,4);
begin
  -- Only process if the new client has an invited_by_client_id
  if NEW.invited_by_client_id is null then
    return NEW;
  end if;

  -- Find if the inviting client is assigned to a partner
  select 
    cpa.partner_id,
    cpa.split_partner_override,
    cpa.split_owner_override
  into 
    inviter_partner_id,
    inviter_split_partner,
    inviter_split_owner
  from public.client_partner_assignments cpa
  where cpa.client_id = NEW.invited_by_client_id
  limit 1;

  -- If the inviter is assigned to a partner, assign the new client to the same partner
  if inviter_partner_id is not null then
    -- Check if assignment already exists (prevent duplicates)
    if not exists (
      select 1 from public.client_partner_assignments
      where client_id = NEW.id and partner_id = inviter_partner_id
    ) then
      insert into public.client_partner_assignments (
        client_id,
        partner_id,
        split_partner_override,
        split_owner_override,
        notes
      ) values (
        NEW.id,
        inviter_partner_id,
        inviter_split_partner,  -- Inherit the split override if exists
        inviter_split_owner,    -- Inherit the split override if exists
        'Auto-assigned from invited_by_client_id'
      );
    end if;
  end if;

  return NEW;
end;
$$;

-- Create trigger
drop trigger if exists trg_auto_assign_partner_from_invited_by on public.clients;
create trigger trg_auto_assign_partner_from_invited_by
  after insert on public.clients
  for each row
  execute function public.auto_assign_partner_from_invited_by();

-- Also handle updates to invited_by_client_id
create or replace function public.auto_assign_partner_on_invited_by_update()
returns trigger
language plpgsql
security definer
as $$
declare
  inviter_partner_id uuid;
  inviter_split_partner numeric(5,4);
  inviter_split_owner numeric(5,4);
begin
  -- Only process if invited_by_client_id changed and is not null
  if NEW.invited_by_client_id is null or NEW.invited_by_client_id = OLD.invited_by_client_id then
    return NEW;
  end if;

  -- Find if the inviting client is assigned to a partner
  select 
    cpa.partner_id,
    cpa.split_partner_override,
    cpa.split_owner_override
  into 
    inviter_partner_id,
    inviter_split_partner,
    inviter_split_owner
  from public.client_partner_assignments cpa
  where cpa.client_id = NEW.invited_by_client_id
  limit 1;

  -- If the inviter is assigned to a partner, assign this client to the same partner
  if inviter_partner_id is not null then
    -- Check if assignment already exists
    if not exists (
      select 1 from public.client_partner_assignments
      where client_id = NEW.id and partner_id = inviter_partner_id
    ) then
      insert into public.client_partner_assignments (
        client_id,
        partner_id,
        split_partner_override,
        split_owner_override,
        notes
      ) values (
        NEW.id,
        inviter_partner_id,
        inviter_split_partner,
        inviter_split_owner,
        'Auto-assigned from invited_by_client_id update'
      );
    end if;
  end if;

  return NEW;
end;
$$;

-- Create trigger for updates
drop trigger if exists trg_auto_assign_partner_on_invited_by_update on public.clients;
create trigger trg_auto_assign_partner_on_invited_by_update
  after update of invited_by_client_id on public.clients
  for each row
  execute function public.auto_assign_partner_on_invited_by_update();

