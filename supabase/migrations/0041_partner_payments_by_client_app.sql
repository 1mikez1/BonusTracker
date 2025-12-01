-- Migration: Track partner payments per client-app

create table if not exists public.partner_payments_by_client_app (
  id uuid primary key default uuid_generate_v4(),
  partner_id uuid not null references public.client_partners(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  client_app_id uuid not null references public.client_apps(id) on delete cascade,
  amount numeric,
  note text,
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(partner_id, client_app_id)
);

alter table public.partner_payments_by_client_app enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'partner_payments_by_client_app'
      and policyname = 'partner_payments_by_client_app_select'
  ) then
    create policy partner_payments_by_client_app_select
      on public.partner_payments_by_client_app
      for select
      using ( auth.role() = 'authenticated' );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'partner_payments_by_client_app'
      and policyname = 'partner_payments_by_client_app_modify'
  ) then
    create policy partner_payments_by_client_app_modify
      on public.partner_payments_by_client_app
      for all
      using ( auth.role() = 'authenticated' )
      with check ( auth.role() = 'authenticated' );
  end if;
end $$;

create index if not exists idx_partner_payments_by_client_app_partner_id
  on public.partner_payments_by_client_app (partner_id);

create index if not exists idx_partner_payments_by_client_app_client_id
  on public.partner_payments_by_client_app (client_id);

create index if not exists idx_partner_payments_by_client_app_client_app_id
  on public.partner_payments_by_client_app (client_app_id);

