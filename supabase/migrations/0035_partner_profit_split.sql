-- Migration: Partner profit split system

create table if not exists public.client_partners (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  contact_info text,
  default_split_partner numeric(5,4) not null default 0.25,
  default_split_owner numeric(5,4) not null default 0.75,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.client_partners enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'client_partners'
      and policyname = 'client_partners_select'
  ) then
    create policy client_partners_select
      on public.client_partners
      for select
      using ( auth.role() = 'authenticated' );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'client_partners'
      and policyname = 'client_partners_modify'
  ) then
    create policy client_partners_modify
      on public.client_partners
      for all
      using ( auth.role() = 'authenticated' )
      with check ( auth.role() = 'authenticated' );
  end if;
end $$;

create table if not exists public.client_partner_assignments (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references public.clients(id) on delete cascade,
  partner_id uuid not null references public.client_partners(id) on delete cascade,
  split_partner_override numeric(5,4),
  split_owner_override numeric(5,4),
  notes text,
  assigned_at timestamptz not null default now()
);

alter table public.client_partner_assignments enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'client_partner_assignments'
      and policyname = 'client_partner_assignments_select'
  ) then
    create policy client_partner_assignments_select
      on public.client_partner_assignments
      for select
      using ( auth.role() = 'authenticated' );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'client_partner_assignments'
      and policyname = 'client_partner_assignments_modify'
  ) then
    create policy client_partner_assignments_modify
      on public.client_partner_assignments
      for all
      using ( auth.role() = 'authenticated' )
      with check ( auth.role() = 'authenticated' );
  end if;
end $$;

create index if not exists idx_client_partner_assignments_client_id
  on public.client_partner_assignments (client_id);

create index if not exists idx_client_partner_assignments_partner_id
  on public.client_partner_assignments (partner_id);

create table if not exists public.partner_payments (
  id uuid primary key default uuid_generate_v4(),
  partner_id uuid not null references public.client_partners(id) on delete cascade,
  amount numeric not null,
  note text,
  paid_at timestamptz not null default now()
);

alter table public.partner_payments enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'partner_payments'
      and policyname = 'partner_payments_select'
  ) then
    create policy partner_payments_select
      on public.partner_payments
      for select
      using ( auth.role() = 'authenticated' );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'partner_payments'
      and policyname = 'partner_payments_modify'
  ) then
    create policy partner_payments_modify
      on public.partner_payments
      for all
      using ( auth.role() = 'authenticated' )
      with check ( auth.role() = 'authenticated' );
  end if;
end $$;

create index if not exists idx_partner_payments_partner_id
  on public.partner_payments (partner_id);

-- Helper function: compute partner profit split per client_app

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
      sum(coalesce(ca.profit_us, 0)) as total_profit_us
    from public.client_apps ca
    where ca.status in ('completed','paid')
    group by ca.client_id
  )
  select
    a.client_id,
    c.name as client_name,
    coalesce(p.total_profit_us, 0) as total_profit_us,
    coalesce(p.total_profit_us, 0) * a.split_partner as partner_share,
    coalesce(p.total_profit_us, 0) * a.split_owner   as owner_share
  from assignments a
  join public.clients c on c.id = a.client_id
  left join profits p on p.client_id = a.client_id;
$$;


