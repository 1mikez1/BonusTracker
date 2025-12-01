-- Migration: Auto-assign partner when client has invited_by_partner_id set
-- When a client has invited_by_partner_id set, automatically assign the client to that partner

-- Function to handle INSERT operations
create or replace function public.auto_assign_partner_from_invited_by_partner_id()
returns trigger
language plpgsql
security definer
as $$
begin
  -- Only process if the new client has an invited_by_partner_id
  if NEW.invited_by_partner_id is null then
    return NEW;
  end if;

  -- Check if assignment already exists (prevent duplicates)
  if not exists (
    select 1 from public.client_partner_assignments
    where client_id = NEW.id and partner_id = NEW.invited_by_partner_id
  ) then
    insert into public.client_partner_assignments (
      client_id,
      partner_id,
      split_partner_override,
      split_owner_override,
      notes
    ) values (
      NEW.id,
      NEW.invited_by_partner_id,
      null,  -- Use partner's default split
      null,  -- Use partner's default split
      'Auto-assigned: invited by partner (direct)'
    );
  end if;

  return NEW;
end;
$$;

-- Function to handle UPDATE operations
create or replace function public.auto_assign_partner_on_invited_by_partner_id_update()
returns trigger
language plpgsql
security definer
as $$
begin
  -- Handle case where invited_by_partner_id is set to NULL (remove auto-assignments)
  if NEW.invited_by_partner_id is null and OLD.invited_by_partner_id is not null then
    -- Remove auto-assigned assignments for this client from the old partner
    delete from public.client_partner_assignments
    where client_id = NEW.id
      and partner_id = OLD.invited_by_partner_id
      and notes like 'Auto-assigned: invited by partner (direct)%';
  end if;

  -- Handle case where invited_by_partner_id changed to a new partner
  if NEW.invited_by_partner_id is not null 
     and (OLD.invited_by_partner_id is null or NEW.invited_by_partner_id != OLD.invited_by_partner_id) then
    -- Remove old auto-assigned assignments if partner changed
    if OLD.invited_by_partner_id is not null then
      delete from public.client_partner_assignments
      where client_id = NEW.id
        and partner_id = OLD.invited_by_partner_id
        and notes like 'Auto-assigned: invited by partner (direct)%';
    end if;

    -- Create new assignment for the new partner
    if not exists (
      select 1 from public.client_partner_assignments
      where client_id = NEW.id and partner_id = NEW.invited_by_partner_id
    ) then
      insert into public.client_partner_assignments (
        client_id,
        partner_id,
        split_partner_override,
        split_owner_override,
        notes
      ) values (
        NEW.id,
        NEW.invited_by_partner_id,
        null,  -- Use partner's default split
        null,  -- Use partner's default split
        'Auto-assigned: invited by partner (direct)'
      );
    end if;
  end if;

  return NEW;
end;
$$;

-- Create trigger for INSERT
drop trigger if exists trg_auto_assign_partner_from_invited_by_partner_id on public.clients;
create trigger trg_auto_assign_partner_from_invited_by_partner_id
  after insert on public.clients
  for each row
  execute function public.auto_assign_partner_from_invited_by_partner_id();

-- Create trigger for UPDATE
drop trigger if exists trg_auto_assign_partner_on_invited_by_partner_id_update on public.clients;
create trigger trg_auto_assign_partner_on_invited_by_partner_id_update
  after update of invited_by_partner_id on public.clients
  for each row
  execute function public.auto_assign_partner_on_invited_by_partner_id_update();

-- Backfill: Assign existing clients to partners based on invited_by_partner_id
do $$
declare
  client_record record;
begin
  for client_record in 
    select id, invited_by_partner_id
    from public.clients
    where invited_by_partner_id is not null
  loop
    -- Check if assignment already exists
    if not exists (
      select 1 from public.client_partner_assignments
      where client_id = client_record.id 
        and partner_id = client_record.invited_by_partner_id
    ) then
      insert into public.client_partner_assignments (
        client_id,
        partner_id,
        split_partner_override,
        split_owner_override,
        notes
      ) values (
        client_record.id,
        client_record.invited_by_partner_id,
        null,
        null,
        'Auto-assigned: invited by partner (direct) - backfilled'
      );
    end if;
  end loop;
end $$;

