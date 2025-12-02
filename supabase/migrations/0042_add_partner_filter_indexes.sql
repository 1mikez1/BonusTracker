-- Migration: Add indexes for partner filtering optimization
-- This migration ensures efficient queries when filtering clients by partner

-- Index on client_partners.name for case-insensitive search (if not exists)
create index if not exists idx_client_partners_name_lower 
  on public.client_partners (lower(name));

-- Composite index for client_partner_assignments lookups
-- This helps when filtering clients by partner_id
create index if not exists idx_client_partner_assignments_partner_client 
  on public.client_partner_assignments (partner_id, client_id);

-- Index on clients.created_at for sorting (if not exists)
create index if not exists idx_clients_created_at 
  on public.clients (created_at desc);

-- Function to get clients by partner (with search support)
create or replace function public.get_clients_by_partner(
  in_partner_id uuid default null,
  in_partner_name_search text default null,
  in_search text default null,
  in_limit int default 100,
  in_offset int default 0,
  in_order_by text default 'created_at',
  in_order_dir text default 'desc'
) returns table (
  id uuid,
  name text,
  surname text,
  contact text,
  email text,
  trusted boolean,
  tier_id uuid,
  invited_by_client_id uuid,
  invited_by_partner_id uuid,
  notes text,
  created_at timestamptz,
  partner_id uuid,
  partner_name text,
  total_apps bigint,
  total_profit_us numeric
) language plpgsql stable as $$
begin
  return query
  with partner_filtered as (
    select distinct
      c.id,
      c.name,
      c.surname,
      c.contact,
      c.email,
      c.trusted,
      c.tier_id,
      c.invited_by_client_id,
      c.invited_by_partner_id,
      c.notes,
      c.created_at,
      cpa.partner_id,
      cp.name as partner_name
    from public.clients c
    left join public.client_partner_assignments cpa on cpa.client_id = c.id
    left join public.client_partners cp on cp.id = cpa.partner_id
    where 
      -- Filter by partner_id if provided
      (in_partner_id is null or cpa.partner_id = in_partner_id)
      -- Filter by partner name search if provided
      and (
        in_partner_name_search is null 
        or in_partner_name_search = ''
        or lower(cp.name) like '%' || lower(in_partner_name_search) || '%'
      )
      -- Filter by client search if provided
      and (
        in_search is null 
        or in_search = ''
        or lower(c.name) like '%' || lower(in_search) || '%'
        or lower(c.surname) like '%' || lower(in_search) || '%'
        or lower(c.contact) like '%' || lower(in_search) || '%'
        or lower(c.email) like '%' || lower(in_search) || '%'
      )
  ),
  client_stats as (
    select
      ca.client_id,
      count(*) as total_apps,
      sum(coalesce(ca.profit_us, 0)) as total_profit_us
    from public.client_apps ca
    group by ca.client_id
  )
  select
    pf.id,
    pf.name,
    pf.surname,
    pf.contact,
    pf.email,
    pf.trusted,
    pf.tier_id,
    pf.invited_by_client_id,
    pf.invited_by_partner_id,
    pf.notes,
    pf.created_at,
    pf.partner_id,
    pf.partner_name,
    coalesce(cs.total_apps, 0)::bigint as total_apps,
    coalesce(cs.total_profit_us, 0) as total_profit_us
  from partner_filtered pf
  left join client_stats cs on cs.client_id = pf.id
  order by
    case when in_order_by = 'created_at' and in_order_dir = 'asc' then pf.created_at end asc,
    case when in_order_by = 'created_at' and in_order_dir = 'desc' then pf.created_at end desc,
    case when in_order_by = 'name' and in_order_dir = 'asc' then pf.name end asc,
    case when in_order_by = 'name' and in_order_dir = 'desc' then pf.name end desc
  limit in_limit
  offset in_offset;
end;
$$;

-- Grant execute permission to authenticated users
grant execute on function public.get_clients_by_partner to authenticated;

