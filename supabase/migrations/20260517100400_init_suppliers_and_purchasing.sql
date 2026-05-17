-- =============================================================================
-- ShopOS - Step 4 - Migration 05: Suppliers, Purchase Orders, Goods Receipts
-- =============================================================================

-- Suppliers -------------------------------------------------------------------
create table public.suppliers (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants(id) on delete cascade,
  code               text,
  name               text not null,
  legal_name         text,
  vat_number         text,
  contact_name       text,
  email              citext,
  phone              text,
  address_line1      text,
  address_line2      text,
  city               text,
  county             text,
  eircode            text,
  country            text not null default 'IE',
  payment_terms      text,                   -- e.g. "Net 30"
  default_lead_time_days integer default 7,
  default_currency   text not null default 'EUR',
  is_active          boolean not null default true,
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  created_by         uuid references auth.users(id) on delete set null,
  updated_by         uuid references auth.users(id) on delete set null,
  unique (tenant_id, code)
);

create index suppliers_tenant_idx on public.suppliers (tenant_id);
create index suppliers_active_idx on public.suppliers (tenant_id, is_active);
create index suppliers_name_trgm on public.suppliers using gin (name gin_trgm_ops);

create trigger suppliers_set_updated_at
  before update on public.suppliers
  for each row execute function app.set_updated_at();

-- Now that suppliers exist, attach FK from products.default_supplier_id
alter table public.products
  add constraint products_default_supplier_fk
  foreign key (default_supplier_id) references public.suppliers(id) on delete set null;

-- Purchase orders -------------------------------------------------------------
create table public.purchase_orders (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  branch_id         uuid not null references public.branches(id) on delete restrict,
  supplier_id       uuid not null references public.suppliers(id) on delete restrict,
  po_number         text not null,
  status            public.purchase_order_status not null default 'draft',
  ordered_at        timestamptz,
  expected_at       date,
  notes             text,
  subtotal          numeric(14,4) not null default 0,
  vat_total         numeric(14,4) not null default 0,
  total             numeric(14,4) not null default 0,
  currency          text not null default 'EUR',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        uuid references auth.users(id) on delete set null,
  updated_by        uuid references auth.users(id) on delete set null,
  approved_by       uuid references auth.users(id) on delete set null,
  approved_at       timestamptz,
  unique (tenant_id, po_number)
);

create index purchase_orders_tenant_idx on public.purchase_orders (tenant_id);
create index purchase_orders_branch_idx on public.purchase_orders (branch_id);
create index purchase_orders_supplier_idx on public.purchase_orders (supplier_id);
create index purchase_orders_status_idx on public.purchase_orders (tenant_id, status);

create trigger purchase_orders_set_updated_at
  before update on public.purchase_orders
  for each row execute function app.set_updated_at();

create table public.purchase_order_items (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  purchase_order_id   uuid not null references public.purchase_orders(id) on delete cascade,
  product_id          uuid not null references public.products(id) on delete restrict,
  variant_id          uuid references public.product_variants(id) on delete set null,
  quantity            numeric(14,4) not null check (quantity > 0),
  unit_cost           numeric(14,4) not null check (unit_cost >= 0),
  vat_code            public.vat_code not null default 'STD',
  line_subtotal       numeric(14,4) generated always as (quantity * unit_cost) stored,
  notes               text,
  qty_received        numeric(14,4) not null default 0,
  qty_outstanding     numeric(14,4) generated always as (greatest(quantity - qty_received, 0)) stored,
  position            integer not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index po_items_po_idx on public.purchase_order_items (purchase_order_id);
create index po_items_product_idx on public.purchase_order_items (product_id);

create trigger po_items_set_updated_at
  before update on public.purchase_order_items
  for each row execute function app.set_updated_at();

-- Goods receipts --------------------------------------------------------------
create table public.goods_receipts (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants(id) on delete cascade,
  branch_id          uuid not null references public.branches(id) on delete restrict,
  supplier_id        uuid not null references public.suppliers(id) on delete restrict,
  purchase_order_id  uuid references public.purchase_orders(id) on delete set null,
  gr_number          text not null,
  status             public.goods_receipt_status not null default 'draft',
  received_at        timestamptz not null default now(),
  invoice_number     text,
  invoice_total      numeric(14,4),
  invoice_url        text,
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  created_by         uuid references auth.users(id) on delete set null,
  finalised_at       timestamptz,
  finalised_by       uuid references auth.users(id) on delete set null,
  unique (tenant_id, gr_number)
);

create index goods_receipts_tenant_idx on public.goods_receipts (tenant_id);
create index goods_receipts_branch_idx on public.goods_receipts (branch_id);
create index goods_receipts_supplier_idx on public.goods_receipts (supplier_id);
create index goods_receipts_po_idx on public.goods_receipts (purchase_order_id);

create trigger goods_receipts_set_updated_at
  before update on public.goods_receipts
  for each row execute function app.set_updated_at();

create table public.goods_receipt_items (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants(id) on delete cascade,
  goods_receipt_id   uuid not null references public.goods_receipts(id) on delete cascade,
  product_id         uuid not null references public.products(id) on delete restrict,
  variant_id         uuid references public.product_variants(id) on delete set null,
  batch_id           uuid references public.batches(id) on delete set null,
  quantity           numeric(14,4) not null check (quantity > 0),
  unit_cost          numeric(14,4) not null check (unit_cost >= 0),
  vat_code           public.vat_code not null default 'STD',
  expiry_date        date,
  lot_no             text,
  notes              text,
  position           integer not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index gr_items_gr_idx on public.goods_receipt_items (goods_receipt_id);
create index gr_items_product_idx on public.goods_receipt_items (product_id);

create trigger gr_items_set_updated_at
  before update on public.goods_receipt_items
  for each row execute function app.set_updated_at();
