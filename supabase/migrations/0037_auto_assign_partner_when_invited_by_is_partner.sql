-- Migration: Auto-assign partner when client is invited by a partner
-- If the inviting client IS a partner (exists in client_partners), automatically assign the new client to that partner

-- Update the function to check if the inviter IS a partner
create or replace function public.auto_assign_partner_from_invited_by()
returns trigger
language plpgsql
security definer
as $$
declare
  inviter_partner_id uuid;
  inviter_client_name text;
  inviter_client_surname text;
  inviter_full_name text;
begin
  -- Only process if the new client has an invited_by_client_id
  if NEW.invited_by_client_id is null then
    return NEW;
  end if;

  -- Get the inviter's name
  select name, surname into inviter_client_name, inviter_client_surname
  from public.clients
  where id = NEW.invited_by_client_id;

  if inviter_client_name is null then
    return NEW;
  end if;

  -- Build full name (name + surname if exists)
  inviter_full_name := inviter_client_name;
  if inviter_client_surname is not null and inviter_client_surname != '' then
    inviter_full_name := inviter_full_name || ' ' || inviter_client_surname;
  end if;

  -- Check if the inviter IS a partner (exists in client_partners with matching name)
  -- Try exact match first, then try name only match
  select id into inviter_partner_id
  from public.client_partners
  where name = inviter_full_name
     or name = inviter_client_name
  limit 1;

  -- If the inviter IS a partner, assign the new client to that partner
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
        null,  -- Use partner's default split
        null,  -- Use partner's default split
        'Auto-assigned: invited by partner ' || inviter_full_name
      );
    end if;
  end if;

  return NEW;
end;
$$;

-- Update the function for UPDATE operations
create or replace function public.auto_assign_partner_on_invited_by_update()
returns trigger
language plpgsql
security definer
as $$
declare
  inviter_partner_id uuid;
  inviter_client_name text;
  inviter_client_surname text;
  inviter_full_name text;
begin
  -- Only process if invited_by_client_id changed and is not null
  if NEW.invited_by_client_id is null or NEW.invited_by_client_id = OLD.invited_by_client_id then
    return NEW;
  end if;

  -- Get the inviter's name
  select name, surname into inviter_client_name, inviter_client_surname
  from public.clients
  where id = NEW.invited_by_client_id;

  if inviter_client_name is null then
    return NEW;
  end if;

  -- Build full name (name + surname if exists)
  inviter_full_name := inviter_client_name;
  if inviter_client_surname is not null and inviter_client_surname != '' then
    inviter_full_name := inviter_full_name || ' ' || inviter_client_surname;
  end if;

  -- Check if the inviter IS a partner (exists in client_partners with matching name)
  -- Try exact match first, then try name only match
  select id into inviter_partner_id
  from public.client_partners
  where name = inviter_full_name
     or name = inviter_client_name
  limit 1;

  -- If the inviter IS a partner, assign this client to that partner
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
        null,  -- Use partner's default split
        null,  -- Use partner's default split
        'Auto-assigned: invited by partner ' || inviter_full_name
      );
    end if;
  end if;

  return NEW;
end;
$$;

