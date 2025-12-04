-- Migration: Partner app-specific profit splits
-- Allows different profit splits per partner/app combination (e.g., Buddy 10/90, Kraken 35/65)

create table if not exists public.partner_app_splits (
  id uuid primary key default uuid_generate_v4(),
  partner_id uuid not null references public.client_partners(id) on delete cascade,
  app_id uuid not null references public.apps(id) on delete cascade,
  split_partner numeric(5,4) not null,
  split_owner numeric(5,4) not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partner_app_splits_unique unique (partner_id, app_id),
  constraint partner_app_splits_sum_check check (split_partner + split_owner = 1.0)
);

alter table public.partner_app_splits enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'partner_app_splits'
      and policyname = 'partner_app_splits_select'
  ) then
    create policy partner_app_splits_select
      on public.partner_app_splits
      for select
      using ( auth.role() = 'authenticated' );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'partner_app_splits'
      and policyname = 'partner_app_splits_modify'
  ) then
    create policy partner_app_splits_modify
      on public.partner_app_splits
      for all
      using ( auth.role() = 'authenticated' )
      with check ( auth.role() = 'authenticated' );
  end if;
end $$;

create index if not exists idx_partner_app_splits_partner_id
  on public.partner_app_splits (partner_id);

create index if not exists idx_partner_app_splits_app_id
  on public.partner_app_splits (app_id);

create index if not exists idx_partner_app_splits_partner_app
  on public.partner_app_splits (partner_id, app_id);

-- Function to update updated_at timestamp
create or replace function public.update_partner_app_splits_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_partner_app_splits_updated_at
  before update on public.partner_app_splits
  for each row
  execute function public.update_partner_app_splits_updated_at();

-- Update compute_partner_split_for_client to use app-specific splits
create or replace function public.compute_partner_split_for_client(
  in_partner_id uuid
) returns table (
  client_id uuid,
  client_name text,
  total_profit_us numeric,
  partner_share numeric,
  owner_share numeric
) language sql stable as $$
  with assignments as (
    select
      cpa.client_id,
      coalesce(cpa.split_partner_override, cp.default_split_partner) as split_partner,
      coalesce(cpa.split_owner_override, cp.default_split_owner)   as split_owner
    from public.client_partner_assignments cpa
    join public.client_partners cp on cp.id = cpa.partner_id
    where cpa.partner_id = in_partner_id
  ),
  profits as (
    select
      ca.client_id,
      ca.app_id,
      sum(coalesce(ca.profit_us, 0)) as total_profit_us
    from public.client_apps ca
    where ca.status in ('completed','paid')
    group by ca.client_id, ca.app_id
  ),
  profits_with_splits as (
    select
      p.client_id,
      p.app_id,
      p.total_profit_us,
      -- Priority: 1) app-specific split, 2) assignment override, 3) partner default
      coalesce(
        pas.split_partner,
        a.split_partner
      ) as split_partner,
      coalesce(
        pas.split_owner,
        a.split_owner
      ) as split_owner
    from profits p
    join assignments a on a.client_id = p.client_id
    left join public.partner_app_splits pas 
      on pas.partner_id = in_partner_id 
      and pas.app_id = p.app_id
  )
  select
    pws.client_id,
    c.name as client_name,
    sum(pws.total_profit_us) as total_profit_us,
    sum(pws.total_profit_us * pws.split_partner) as partner_share,
    sum(pws.total_profit_us * pws.split_owner) as owner_share
  from profits_with_splits pws
  join public.clients c on c.id = pws.client_id
  group by pws.client_id, c.name;
$$;

