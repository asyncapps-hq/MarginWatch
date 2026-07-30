-- MarginWatch schema v0.1
create extension if not exists "pgcrypto";

create table public.suppliers (
  id text primary key,
  name text not null,
  base_url text not null,
  login_user_env text not null default 'PORTAL_USER',
  login_pass_env text not null default 'PORTAL_PASS',
  threshold_pct numeric not null default 0.05,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.skus (
  id uuid primary key default gen_random_uuid(),
  supplier_id text not null references public.suppliers(id) on delete cascade,
  external_sku text not null,
  title text not null,
  currency text not null default 'USD',
  unique (supplier_id, external_sku)
);

create table public.scrape_runs (
  id uuid primary key default gen_random_uuid(),
  supplier_id text not null references public.suppliers(id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null check (status in ('ok','auth_failed','parse_failed','partial')),
  item_count int not null default 0,
  error text
);

create table public.price_snapshots (
  id uuid primary key default gen_random_uuid(),
  sku_id uuid not null references public.skus(id) on delete cascade,
  price numeric not null,
  observed_at timestamptz not null default now(),
  run_id uuid not null references public.scrape_runs(id) on delete cascade,
  raw jsonb not null default '{}'::jsonb
);

create table public.price_changes (
  id uuid primary key default gen_random_uuid(),
  sku_id uuid not null references public.skus(id) on delete cascade,
  old_price numeric,
  new_price numeric,
  pct_change numeric,
  direction text not null,
  run_id uuid not null references public.scrape_runs(id) on delete cascade,
  alerted boolean not null default false
);

create table public.alert_events (
  id uuid primary key default gen_random_uuid(),
  change_id uuid not null references public.price_changes(id) on delete cascade,
  channel text not null check (channel in ('email','outbox')),
  payload jsonb not null,
  sent_at timestamptz not null default now(),
  status text not null default 'sent'
);

create table public.worker_sessions (
  supplier_id text primary key references public.suppliers(id) on delete cascade,
  path text not null,
  checksum text,
  updated_at timestamptz not null default now()
);

alter table public.suppliers enable row level security;
alter table public.skus enable row level security;
alter table public.scrape_runs enable row level security;
alter table public.price_snapshots enable row level security;
alter table public.price_changes enable row level security;
alter table public.alert_events enable row level security;
alter table public.worker_sessions enable row level security;

-- ponytail: public read for demo dashboard; writes via service role
create policy suppliers_read on public.suppliers for select using (true);
create policy skus_read on public.skus for select using (true);
create policy runs_read on public.scrape_runs for select using (true);
create policy snaps_read on public.price_snapshots for select using (true);
create policy changes_read on public.price_changes for select using (true);
create policy alerts_read on public.alert_events for select using (true);

insert into public.suppliers (id, name, base_url)
values ('demo-supplier', 'SEA Parts Demo', 'http://127.0.0.1:4010');
