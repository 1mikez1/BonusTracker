-- Migration: Add payment tracking for referral links

create table if not exists public.referral_link_payments (
  id uuid primary key default uuid_generate_v4(),
  referral_link_id uuid not null references public.referral_links(id) on delete cascade,
  amount numeric(12,2) not null,
  payment_source text not null,
  notes text,
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_referral_link_payments_referral_link_id 
  on public.referral_link_payments(referral_link_id);

alter table public.referral_link_payments enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'referral_link_payments'
      and policyname = 'referral_link_payments_select'
  ) then
    create policy referral_link_payments_select
      on public.referral_link_payments
      for select
      using ( auth.role() = 'authenticated' );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'referral_link_payments'
      and policyname = 'referral_link_payments_modify'
  ) then
    create policy referral_link_payments_modify
      on public.referral_link_payments
      for all
      using ( auth.role() = 'authenticated' )
      with check ( auth.role() = 'authenticated' );
  end if;
end $$;

