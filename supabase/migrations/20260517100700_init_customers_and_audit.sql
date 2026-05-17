-- =============================================================================
-- ShopOS - Step 4 - Migration 08: Customers, audit logs, notifications, idempotency
-- =============================================================================

-- Customers -------------------------------------------------------------------
create table public.customers (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  code            text,
  full_name       text not null,
  email           citext,
  phone           text,
  vat_number      text,
  address_line1   text,
  address_line2   text,
  city            text,
  county          text,
  eircode         text,
  country         text not null default 'IE',
  notes           text,
  marketing_optin boolean not null default false,
  is_b2b          boolean not null default false,
  credit_limit    numeric(14,4) not null default 0,
  credit_balance  numeric(14,4) not null default 0,
  loyalty_balance numeric(14,4) not null default 0,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id) on delete set null,
  updated_by      uuid references auth.users(id) on delete set null,
  unique (tenant_id, code),
  unique (tenant_id, email)
);

create index customers_tenant_idx on public.customers (tenant_id);
create index customers_phone_idx on public.customers (tenant_id, phone);
create index customers_name_trgm on public.customers using gin (full_name gin_trgm_ops);

create trigger customers_set_updated_at
  before update on public.customers
  for each row execute function app.set_updated_at();

-- Now that customers table exists, link sales.customer_id ----------------
alter table public.sales
  add constraint sales_customer_fk
  foreign key (customer_id) references public.customers(id) on delete set null;

-- Audit logs ------------------------------------------------------------------
create table public.audit_logs (
  id           bigserial primary key,
  tenant_id    uuid references public.tenants(id) on delete cascade,
  user_id      uuid references auth.users(id) on delete set null,
  action       text not null,                        -- e.g. 'product.update'
  entity_type  text not null,                        -- e.g. 'product'
  entity_id    uuid,
  before       jsonb,
  after        jsonb,
  ip           inet,
  user_agent   text,
  created_at   timestamptz not null default now()
);

create index audit_logs_tenant_idx on public.audit_logs (tenant_id, created_at desc);
create index audit_logs_user_idx on public.audit_logs (user_id, created_at desc);
create index audit_logs_entity_idx on public.audit_logs (tenant_id, entity_type, entity_id);

-- Notifications --------------------------------------------------------------
create table public.notifications (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  user_id      uuid references auth.users(id) on delete cascade,
  type         text not null,                       -- 'low_stock','expiring','cash_variance', etc.
  title        text not null,
  body         text,
  data         jsonb default '{}'::jsonb,
  is_read      boolean not null default false,
  read_at      timestamptz,
  created_at   timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, is_read, created_at desc);
create index notifications_tenant_idx on public.notifications (tenant_id, created_at desc);

-- Idempotency keys (for POS sale + online order create) ----------------------
create table public.idempotency_keys (
  key           text primary key,
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  user_id       uuid references auth.users(id) on delete set null,
  request_hash  text,
  response_body jsonb,
  status_code   integer,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null default (now() + interval '24 hours')
);

create index idempotency_keys_tenant_idx on public.idempotency_keys (tenant_id);
create index idempotency_keys_expires_idx on public.idempotency_keys (expires_at);

-- Outbox (reliable event delivery) -------------------------------------------
create table public.outbox (
  id              bigserial primary key,
  tenant_id       uuid references public.tenants(id) on delete cascade,
  topic           text not null,
  payload         jsonb not null,
  status          text not null default 'pending',  -- pending | sent | failed
  attempts        integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error      text,
  created_at      timestamptz not null default now(),
  sent_at         timestamptz
);

create index outbox_pending_idx on public.outbox (status, next_attempt_at) where status = 'pending';
