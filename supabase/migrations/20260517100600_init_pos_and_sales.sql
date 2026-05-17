-- =============================================================================
-- ShopOS - Step 4 - Migration 07: POS terminals, sessions, sales, payments
-- =============================================================================

-- POS terminals ---------------------------------------------------------------
create table public.pos_terminals (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  branch_id     uuid not null references public.branches(id) on delete cascade,
  code          text not null,
  name          text not null,
  is_active     boolean not null default true,
  printer_config  jsonb default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (branch_id, code)
);

create index pos_terminals_tenant_idx on public.pos_terminals (tenant_id);

create trigger pos_terminals_set_updated_at
  before update on public.pos_terminals
  for each row execute function app.set_updated_at();

-- POS sessions (till open/close) ---------------------------------------------
create table public.pos_sessions (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  branch_id       uuid not null references public.branches(id) on delete restrict,
  terminal_id     uuid references public.pos_terminals(id) on delete set null,
  cashier_id      uuid not null references auth.users(id) on delete restrict,
  status          public.pos_session_status not null default 'open',
  opened_at       timestamptz not null default now(),
  closed_at       timestamptz,
  opening_cash    numeric(14,4) not null default 0,
  expected_cash   numeric(14,4),
  counted_cash    numeric(14,4),
  cash_difference numeric(14,4) generated always as (counted_cash - expected_cash) stored,
  closing_note    text,
  closed_by       uuid references auth.users(id) on delete set null,
  manager_pin_used boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index pos_sessions_tenant_idx on public.pos_sessions (tenant_id);
create index pos_sessions_branch_idx on public.pos_sessions (branch_id);
create index pos_sessions_cashier_idx on public.pos_sessions (cashier_id);
create index pos_sessions_status_idx on public.pos_sessions (tenant_id, status);
create index pos_sessions_open_idx on public.pos_sessions (tenant_id, branch_id, status) where status = 'open';

create trigger pos_sessions_set_updated_at
  before update on public.pos_sessions
  for each row execute function app.set_updated_at();

-- Cash drawer movements ------------------------------------------------------
create table public.cash_drawer_movements (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  pos_session_id  uuid not null references public.pos_sessions(id) on delete cascade,
  type            public.cash_movement_type not null,
  amount          numeric(14,4) not null,           -- always positive; type encodes direction
  reason          text,
  reference_type  text,
  reference_id    uuid,
  user_id         uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index cash_movements_session_idx on public.cash_drawer_movements (pos_session_id);
create index cash_movements_tenant_idx on public.cash_drawer_movements (tenant_id);

-- Sales ----------------------------------------------------------------------
create table public.sales (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants(id) on delete cascade,
  branch_id          uuid not null references public.branches(id) on delete restrict,
  pos_session_id     uuid references public.pos_sessions(id) on delete set null,
  terminal_id        uuid references public.pos_terminals(id) on delete set null,
  cashier_id         uuid references auth.users(id) on delete set null,
  customer_id        uuid,                                          -- FK added after customers table

  channel            public.sale_channel not null default 'pos',
  status             public.sale_status not null default 'completed',
  receipt_number     text not null,

  subtotal           numeric(14,4) not null default 0,    -- net of VAT
  discount_total     numeric(14,4) not null default 0,
  vat_total          numeric(14,4) not null default 0,
  total              numeric(14,4) not null default 0,    -- gross (what customer pays)
  rounding           numeric(14,4) not null default 0,

  vat_breakdown      jsonb not null default '{}'::jsonb,  -- { "STD": { rate: 0.23, base: 100, vat: 23 }, ... }

  notes              text,
  voided_at          timestamptz,
  voided_by          uuid references auth.users(id) on delete set null,
  void_reason        text,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  created_by         uuid references auth.users(id) on delete set null,

  unique (tenant_id, receipt_number)
);

create index sales_tenant_idx on public.sales (tenant_id);
create index sales_branch_idx on public.sales (branch_id);
create index sales_session_idx on public.sales (pos_session_id);
create index sales_customer_idx on public.sales (customer_id);
create index sales_created_idx on public.sales (tenant_id, branch_id, created_at desc);
create index sales_status_idx on public.sales (tenant_id, status);

create trigger sales_set_updated_at
  before update on public.sales
  for each row execute function app.set_updated_at();

-- Sale items ------------------------------------------------------------------
create table public.sale_items (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  sale_id         uuid not null references public.sales(id) on delete cascade,
  product_id      uuid not null references public.products(id) on delete restrict,
  variant_id      uuid references public.product_variants(id) on delete set null,
  batch_id        uuid references public.batches(id) on delete set null,
  position        integer not null default 0,
  name_snapshot   text not null,                          -- product name at time of sale
  sku_snapshot    text,
  quantity        numeric(14,4) not null check (quantity > 0),
  unit_price      numeric(14,4) not null,                 -- gross unit price (incl VAT if vat_included)
  unit_cost       numeric(14,4),                          -- captured for COGS reporting
  vat_code        public.vat_code not null default 'STD',
  vat_rate        numeric(6,4) not null default 0.23,
  discount        numeric(14,4) not null default 0,
  line_total_gross numeric(14,4) not null,                -- after discount, including VAT
  line_total_net  numeric(14,4) not null,                 -- net of VAT
  line_vat        numeric(14,4) not null,
  notes           text,
  created_at      timestamptz not null default now()
);

create index sale_items_sale_idx on public.sale_items (sale_id);
create index sale_items_product_idx on public.sale_items (tenant_id, product_id);

-- Payments --------------------------------------------------------------------
create table public.payments (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  sale_id             uuid references public.sales(id) on delete cascade,
  online_order_id     uuid,                                   -- nullable; for online flow later
  method              public.payment_method not null,
  amount              numeric(14,4) not null,
  status              public.payment_status not null default 'captured',
  external_ref        text,                                   -- gateway txn id / terminal slip
  card_brand          text,
  card_last4          text,
  fee                 numeric(14,4),
  captured_at         timestamptz,
  refunded_amount     numeric(14,4) not null default 0,
  refunded_at         timestamptz,
  metadata            jsonb default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  created_by          uuid references auth.users(id) on delete set null
);

create index payments_tenant_idx on public.payments (tenant_id);
create index payments_sale_idx on public.payments (sale_id);
create index payments_status_idx on public.payments (tenant_id, status);
create index payments_method_idx on public.payments (tenant_id, method);

create trigger payments_set_updated_at
  before update on public.payments
  for each row execute function app.set_updated_at();

-- Discounts (catalog of reusable promos) -------------------------------------
create table public.discounts (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  code         text,
  name         text not null,
  type         text not null,                       -- 'percent' | 'amount' | 'bogo'
  value        numeric(14,4) not null,
  is_active    boolean not null default true,
  starts_at    timestamptz,
  ends_at      timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (tenant_id, code)
);

create index discounts_tenant_idx on public.discounts (tenant_id);

create trigger discounts_set_updated_at
  before update on public.discounts
  for each row execute function app.set_updated_at();
