-- Migration: Add surplus field to deposit_debts table
-- Surplus represents extra amount beyond the original deposit (e.g., Sisal: deposit 300, withdraw 380 → surplus = 80)
-- Total debt amount = amount + surplus

-- Add surplus column to deposit_debts
alter table public.deposit_debts
  add column if not exists surplus numeric(12,2) not null default 0;

comment on column public.deposit_debts.surplus is 'Extra amount beyond the original deposit amount. Total debt = amount + surplus (e.g., deposit 300, withdraw 380 → surplus = 80, total = 380)';

-- Create index for queries that might filter by surplus
create index if not exists idx_deposit_debts_surplus
  on public.deposit_debts (surplus)
  where surplus > 0;

