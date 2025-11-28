-- Enable required extensions
create extension if not exists "pgcrypto";

-- Enum types for constrained fields
create type client_app_status as enum (
    'requested',
    'registered',
    'deposited',
    'waiting_bonus',
    'completed',
    'paid',
    'cancelled'
);

create type request_status as enum (
    'new',
    'contacted',
    'converted',
    'rejected'
);

create type referral_link_debt_status as enum (
    'open',
    'partial',
    'settled'
);

-- Tables
create table public.tiers (
    id uuid primary key default gen_random_uuid(),
    name text not null unique,
    priority integer not null,
    notes text
);

create table public.clients (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    surname text,
    contact text,
    email text,
    trusted boolean not null default false,
    tier_id uuid references public.tiers(id),
    invited_by_client_id uuid references public.clients(id),
    notes text,
    created_at timestamptz not null default now()
);

create table public.apps (
    id uuid primary key default gen_random_uuid(),
    name text not null unique,
    app_type text,
    country text,
    is_active boolean not null default true,
    notes text
);

create table public.promotions (
    id uuid primary key default gen_random_uuid(),
    app_id uuid not null references public.apps(id) on delete cascade,
    name text not null,
    client_reward numeric(12,2) not null default 0,
    our_reward numeric(12,2) not null default 0,
    deposit_required numeric(12,2) not null default 0,
    freeze_days integer,
    time_to_get_bonus text,
    start_date date,
    end_date date,
    terms_conditions text,
    notes text
);

create table public.referral_links (
    id uuid primary key default gen_random_uuid(),
    app_id uuid not null references public.apps(id) on delete cascade,
    url text not null,
    owner_client_id uuid references public.clients(id),
    max_uses integer,
    current_uses integer not null default 0,
    is_active boolean not null default true,
    notes text,
    constraint referral_links_unique_url_per_app unique (app_id, url)
);

create table public.referral_link_debts (
    id uuid primary key default gen_random_uuid(),
    referral_link_id uuid not null references public.referral_links(id) on delete cascade,
    creditor_client_id uuid not null references public.clients(id),
    debtor_client_id uuid references public.clients(id),
    amount numeric(12,2) not null,
    status referral_link_debt_status not null default 'open',
    description text,
    created_at timestamptz not null default now(),
    settled_at timestamptz
);

create table public.client_apps (
    id uuid primary key default gen_random_uuid(),
    client_id uuid not null references public.clients(id) on delete cascade,
    app_id uuid not null references public.apps(id) on delete cascade,
    promotion_id uuid references public.promotions(id),
    referral_link_id uuid references public.referral_links(id),
    invited_by_client_id uuid references public.clients(id),
    status client_app_status not null default 'requested',
    deposited boolean not null default false,
    finished boolean not null default false,
    deposit_amount numeric(12,2),
    profit_client numeric(12,2),
    profit_us numeric(12,2),
    created_at timestamptz not null default now(),
    completed_at timestamptz,
    notes text,
    constraint client_apps_unique_client_app unique (client_id, app_id)
);

create table public.requests (
    id uuid primary key default gen_random_uuid(),
    external_form_id text,
    client_id uuid references public.clients(id),
    name text not null,
    contact text,
    requested_apps_raw text,
    notes text,
    status request_status not null default 'new',
    created_at timestamptz not null default now(),
    processed_at timestamptz
);

create table public.credentials (
    id uuid primary key default gen_random_uuid(),
    client_id uuid not null references public.clients(id) on delete cascade,
    app_id uuid not null references public.apps(id) on delete cascade,
    email text not null,
    username text,
    password_encrypted text not null,
    notes text,
    created_at timestamptz not null default now()
);

create table public.payment_links (
    id uuid primary key default gen_random_uuid(),
    provider text not null,
    url text not null,
    amount numeric(12,2),
    purpose text,
    client_id uuid references public.clients(id),
    app_id uuid references public.apps(id),
    used boolean not null default false,
    created_at timestamptz not null default now(),
    used_at timestamptz
);

create table public.slots (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    provider text,
    rtp_percentage numeric(5,2) not null,
    notes text
);

create table public.message_templates (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    app_id uuid references public.apps(id),
    step text,
    language text,
    content text not null,
    notes text
);

-- Indexes for frequent lookups
create index on public.clients (tier_id);
create index on public.clients (invited_by_client_id);
create index on public.client_apps (client_id);
create index on public.client_apps (app_id);
create index on public.client_apps (status);
create index on public.promotions (app_id);
create index on public.referral_links (app_id);
create index on public.referral_links (owner_client_id);
create index on public.requests (status);
create index on public.requests (created_at desc);
create index on public.credentials (client_id);
create index on public.credentials (app_id);
create index on public.payment_links (used);
create index on public.payment_links (client_id);
create index on public.payment_links (app_id);
create index on public.referral_link_debts (creditor_client_id);
create index on public.referral_link_debts (debtor_client_id);
create index on public.message_templates (app_id);
create index on public.message_templates (language);

-- Row Level Security policies
alter table public.tiers enable row level security;
alter table public.clients enable row level security;
alter table public.apps enable row level security;
alter table public.promotions enable row level security;
alter table public.referral_links enable row level security;
alter table public.referral_link_debts enable row level security;
alter table public.client_apps enable row level security;
alter table public.requests enable row level security;
alter table public.credentials enable row level security;
alter table public.payment_links enable row level security;
alter table public.slots enable row level security;
alter table public.message_templates enable row level security;

create policy "tiers authenticated full access"
    on public.tiers
    for all
    using (auth.uid() is not null)
    with check (auth.uid() is not null);

create policy "clients authenticated full access"
    on public.clients
    for all
    using (auth.uid() is not null)
    with check (auth.uid() is not null);

create policy "apps authenticated full access"
    on public.apps
    for all
    using (auth.uid() is not null)
    with check (auth.uid() is not null);

create policy "promotions authenticated full access"
    on public.promotions
    for all
    using (auth.uid() is not null)
    with check (auth.uid() is not null);

create policy "referral_links authenticated full access"
    on public.referral_links
    for all
    using (auth.uid() is not null)
    with check (auth.uid() is not null);

create policy "referral_link_debts authenticated full access"
    on public.referral_link_debts
    for all
    using (auth.uid() is not null)
    with check (auth.uid() is not null);

create policy "client_apps authenticated full access"
    on public.client_apps
    for all
    using (auth.uid() is not null)
    with check (auth.uid() is not null);

create policy "requests authenticated full access"
    on public.requests
    for all
    using (auth.uid() is not null)
    with check (auth.uid() is not null);

create policy "credentials authenticated full access"
    on public.credentials
    for all
    using (auth.uid() is not null)
    with check (auth.uid() is not null);

create policy "payment_links authenticated full access"
    on public.payment_links
    for all
    using (auth.uid() is not null)
    with check (auth.uid() is not null);

create policy "slots authenticated full access"
    on public.slots
    for all
    using (auth.uid() is not null)
    with check (auth.uid() is not null);

create policy "message_templates authenticated full access"
    on public.message_templates
    for all
    using (auth.uid() is not null)
    with check (auth.uid() is not null);

-- Helpful views or computed columns can be added in future migrations.
