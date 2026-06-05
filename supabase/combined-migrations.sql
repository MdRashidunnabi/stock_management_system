-- ShopOS: run once in Supabase SQL Editor if CLI db push cannot connect.
-- https://supabase.com/dashboard/project/dpemvmotwxkrwsqhonhv/sql/new

-- >>> 20260517100000_init_extensions_and_helpers.sql
-- =============================================================================
-- ShopOS - Step 4 - Migration 01: Extensions, app schema, table-independent helpers
-- =============================================================================
--
-- This migration must NOT reference any public.* table because none exist yet.
-- Helpers that need public.user_tenants live in 20260517100250_*.sql, which
-- runs AFTER 20260517100200_init_tenants_and_users.sql.
-- =============================================================================

-- Extensions ------------------------------------------------------------------
create extension if not exists pgcrypto;        -- gen_random_uuid()
create extension if not exists "uuid-ossp";     -- legacy uuid_generate_v4
create extension if not exists citext;          -- case-insensitive text (emails, codes)
create extension if not exists pg_trgm;         -- product/customer search
create extension if not exists btree_gin;       -- composite trigram indexes
create extension if not exists unaccent;        -- search ignoring accents

-- Application namespace -------------------------------------------------------
create schema if not exists app;
comment on schema app is 'ShopOS internal helper functions, types, and admin objects.';

-- =============================================================================
-- Table-independent helpers (safe to define before any public.* table exists)
-- =============================================================================

-- Returns the currently authenticated user, or NULL if anonymous.
-- Only references auth.uid() (provided by the Supabase auth schema, which
-- exists at migration time).
create or replace function app.current_user_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select auth.uid();
$$;

-- Reusable updated_at trigger - no table references in its body.
create or replace function app.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function app.current_user_id is 'Wraps auth.uid() for stable references.';
comment on function app.set_updated_at is 'Trigger that bumps updated_at to now() on every UPDATE.';

-- >>> 20260517100100_init_enums.sql
-- =============================================================================
-- ShopOS - Step 4 - Migration 02: Enumerated types
-- =============================================================================

-- Tenant status
create type public.tenant_status as enum (
  'pending',     -- created but not yet activated
  'trial',       -- in 30-day pilot
  'active',      -- paying customer
  'past_due',    -- payment failed
  'suspended',   -- access blocked by us
  'cancelled'    -- terminated
);

-- User role within a tenant
create type public.user_role as enum (
  'super_admin',     -- ShopOS company staff (platform-wide)
  'support_admin',   -- ShopOS support staff (read + impersonate)
  'owner',           -- the shop owner / tenant admin
  'manager',         -- branch manager
  'cashier',         -- POS operator
  'warehouse',       -- warehouse / receiving staff
  'accountant',      -- read-only financial access
  'delivery'         -- delivery rider for online orders
);

-- POS session (till) status
create type public.pos_session_status as enum (
  'open',
  'closed',
  'force_closed'
);

-- Sale channel
create type public.sale_channel as enum (
  'pos',
  'online',
  'b2b',
  'phone'
);

-- Sale status
create type public.sale_status as enum (
  'completed',
  'voided',
  'refunded',
  'partially_refunded'
);

-- Payment method
create type public.payment_method as enum (
  'cash',
  'card',
  'contactless',
  'apple_pay',
  'google_pay',
  'revolut',
  'bank_transfer',
  'store_credit',
  'customer_account',
  'voucher'
);

-- Payment status
create type public.payment_status as enum (
  'pending',
  'authorised',
  'captured',
  'failed',
  'refunded',
  'partially_refunded',
  'voided'
);

-- Stock movement state
create type public.stock_state as enum (
  'available',
  'reserved',
  'sold',
  'damaged',
  'expired',
  'in_transit',
  'returned',
  'quarantine'
);

-- Stock movement type (reason)
create type public.stock_movement_type as enum (
  'goods_receipt',
  'pos_sale',
  'online_reserve',
  'online_release',
  'online_ship',
  'damaged',
  'expired',
  'transfer_out',
  'transfer_in',
  'return',
  'adjustment',
  'opening_balance',
  'count_correction'
);

-- Purchase order status
create type public.purchase_order_status as enum (
  'draft',
  'submitted',
  'partially_received',
  'received',
  'cancelled',
  'closed'
);

-- Goods receipt status
create type public.goods_receipt_status as enum (
  'draft',
  'finalised',
  'cancelled'
);

-- Cash drawer movement type
create type public.cash_movement_type as enum (
  'opening',
  'sale',
  'refund_out',
  'cash_drop',
  'expense',
  'pay_in',
  'pay_out',
  'closing'
);

-- IE VAT codes (mirror src/lib/constants.ts)
create type public.vat_code as enum (
  'STD',  -- 23%
  'RED',  -- 13.5%
  'SEC',  -- 9%
  'LIV',  -- 4.8%
  'ZER',  -- 0%
  'EXE'   -- exempt
);

-- >>> 20260517100200_init_tenants_and_users.sql
-- =============================================================================
-- ShopOS - Step 4 - Migration 03: Tenants, branches, profiles, user_tenants
-- =============================================================================

-- Tenants ---------------------------------------------------------------------
create table public.tenants (
  id              uuid primary key default gen_random_uuid(),
  slug            citext not null unique,
  legal_name      text not null,
  display_name    text not null,
  vat_number      text,
  country         text not null default 'IE',
  currency        text not null default 'EUR',
  timezone        text not null default 'Europe/Dublin',
  default_locale  text not null default 'en-IE',
  status          public.tenant_status not null default 'trial',
  trial_ends_at   timestamptz,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id) on delete set null,
  updated_by      uuid references auth.users(id) on delete set null
);

create index tenants_status_idx on public.tenants (status);
create index tenants_country_idx on public.tenants (country);

create trigger tenants_set_updated_at
  before update on public.tenants
  for each row execute function app.set_updated_at();

comment on table public.tenants is 'Each row is a paying customer (one shop or shop group).';

-- Branches --------------------------------------------------------------------
create table public.branches (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  code          text not null,
  name          text not null,
  is_warehouse  boolean not null default false,
  is_active     boolean not null default true,
  address_line1 text,
  address_line2 text,
  city          text,
  county        text,
  eircode       text,
  country       text not null default 'IE',
  phone         text,
  email         citext,
  timezone      text not null default 'Europe/Dublin',
  opening_hours jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id) on delete set null,
  updated_by    uuid references auth.users(id) on delete set null,
  unique (tenant_id, code)
);

create index branches_tenant_idx on public.branches (tenant_id);
create index branches_active_idx on public.branches (tenant_id, is_active);

create trigger branches_set_updated_at
  before update on public.branches
  for each row execute function app.set_updated_at();

comment on table public.branches is 'Physical locations under a tenant (a warehouse is a branch with is_warehouse=true).';

-- Profiles (extends auth.users) -----------------------------------------------
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         citext not null,
  full_name     text,
  phone         text,
  avatar_url    text,
  locale        text not null default 'en-IE',
  is_platform_staff boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index profiles_email_idx on public.profiles (email);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function app.set_updated_at();

comment on table public.profiles is 'Public profile data for auth.users (1:1).';

-- Auto-create profile when a Supabase auth user is inserted.
-- SECURITY DEFINER + row_security off so the insert bypasses RLS on profiles.
create or replace function app.handle_new_auth_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  set local row_security = off;
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(public.profiles.full_name, excluded.full_name);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app.handle_new_auth_user();

-- user_tenants (membership + role per tenant) ---------------------------------
create table public.user_tenants (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  role         public.user_role not null,
  branch_id    uuid references public.branches(id) on delete set null,  -- optional scope
  is_active    boolean not null default true,
  invited_by   uuid references auth.users(id) on delete set null,
  invited_at   timestamptz,
  accepted_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, tenant_id, role, branch_id)
);

create index user_tenants_user_idx on public.user_tenants (user_id);
create index user_tenants_tenant_idx on public.user_tenants (tenant_id);
create index user_tenants_active_idx on public.user_tenants (user_id, is_active);

create trigger user_tenants_set_updated_at
  before update on public.user_tenants
  for each row execute function app.set_updated_at();

comment on table public.user_tenants is 'Maps an auth.users to a tenant with a role; a user can belong to many tenants.';

-- Indexes used by RLS predicates
create index branches_tenant_lookup on public.branches (tenant_id, id);

-- >>> 20260517100250_init_tenant_aware_helpers.sql
-- =============================================================================
-- ShopOS - Step 4 - Migration 03b: Tenant-aware helper functions
-- =============================================================================
--
-- These helpers must be defined AFTER public.user_tenants exists.
--
-- Postgres binds names in `language sql` functions at CREATE FUNCTION time
-- (not at call time), so referencing a missing table here would fail.
-- That is why these were split out of the first extensions migration.
--
-- Used by:
--   - All RLS policies (see 20260517109000_init_rls.sql)
--   - SECURITY DEFINER server-side procedures
-- =============================================================================

-- Returns the tenant ids the current user belongs to.
create or replace function app.current_user_tenant_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select ut.tenant_id
  from public.user_tenants ut
  where ut.user_id = auth.uid()
    and ut.is_active = true;
$$;

-- Returns true if the current user has any of the given roles on a tenant.
-- roles_in: text[] (e.g. ARRAY['owner','manager']).
create or replace function app.has_tenant_role(p_tenant_id uuid, roles_in text[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.user_tenants ut
    where ut.user_id = auth.uid()
      and ut.tenant_id = p_tenant_id
      and ut.is_active = true
      and ut.role::text = any(roles_in)
  );
$$;

-- Returns true if the current user is platform staff (our company).
create or replace function app.is_super_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.user_tenants ut
    where ut.user_id = auth.uid()
      and ut.is_active = true
      and ut.role in ('super_admin', 'support_admin')
  );
$$;

comment on function app.current_user_tenant_ids
  is 'Tenant ids the auth user can access (active memberships only).';
comment on function app.has_tenant_role
  is 'True iff the auth user has any of the given roles on the tenant.';
comment on function app.is_super_admin
  is 'True iff the auth user is platform staff (super_admin or support_admin).';

-- >>> 20260517100300_init_catalog.sql
-- =============================================================================
-- ShopOS - Step 4 - Migration 04: Catalog (categories, brands, products, variants, batches)
-- =============================================================================

-- Categories (hierarchical) ---------------------------------------------------
create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  parent_id   uuid references public.categories(id) on delete set null,
  name        text not null,
  slug        text not null,
  position    integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id) on delete set null,
  updated_by  uuid references auth.users(id) on delete set null,
  unique (tenant_id, slug)
);

create index categories_tenant_idx on public.categories (tenant_id);
create index categories_parent_idx on public.categories (parent_id);

create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function app.set_updated_at();

-- Brands ----------------------------------------------------------------------
create table public.brands (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  name        text not null,
  slug        text not null,
  logo_url    text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id) on delete set null,
  updated_by  uuid references auth.users(id) on delete set null,
  unique (tenant_id, slug)
);

create index brands_tenant_idx on public.brands (tenant_id);

create trigger brands_set_updated_at
  before update on public.brands
  for each row execute function app.set_updated_at();

-- Products (master) -----------------------------------------------------------
create table public.products (
  id                       uuid primary key default gen_random_uuid(),
  tenant_id                uuid not null references public.tenants(id) on delete cascade,

  name                     text not null,
  short_name_for_receipt   text,
  sku                      text,
  internal_code            text,
  barcode                  text,
  extra_barcodes           text[] default '{}',

  category_id              uuid references public.categories(id) on delete set null,
  brand_id                 uuid references public.brands(id) on delete set null,
  default_supplier_id      uuid,                              -- FK added after suppliers table exists

  description_short        text,
  description_long         text,                              -- markdown / sanitized html
  primary_image_url        text,
  images                   text[] default '{}',

  -- Commercial
  purchase_price           numeric(14,4) not null default 0,  -- weighted average cost
  selling_price            numeric(14,4) not null default 0,
  vat_code                 public.vat_code not null default 'STD',
  vat_included             boolean not null default true,     -- IE retail prices are usually VAT-inclusive
  margin_target_pct        numeric(6,2),

  -- Units
  base_unit                text not null default 'un',        -- un, kg, L, m...
  weighable                boolean not null default false,
  decimal_qty_allowed      boolean not null default false,
  unit_conversions         jsonb default '[]'::jsonb,         -- e.g. [{"unit":"box","factor":24}]

  -- Tracking
  has_variants             boolean not null default false,
  batch_tracking           boolean not null default false,
  serial_tracking          boolean not null default false,
  default_shelf_life_days  integer,

  -- Online visibility
  online_visible           boolean not null default false,
  online_title             text,
  online_description       text,
  seo_slug                 text,

  -- Compliance
  requires_age_check       boolean not null default false,
  hazmat                   boolean not null default false,

  -- Status
  is_active                boolean not null default true,
  archived_at              timestamptz,

  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  created_by               uuid references auth.users(id) on delete set null,
  updated_by               uuid references auth.users(id) on delete set null,

  unique (tenant_id, sku),
  unique (tenant_id, barcode),
  unique (tenant_id, seo_slug)
);

create index products_tenant_idx on public.products (tenant_id);
create index products_category_idx on public.products (category_id);
create index products_brand_idx on public.products (brand_id);
create index products_active_idx on public.products (tenant_id, is_active);
create index products_online_idx on public.products (tenant_id, online_visible) where online_visible;
create index products_name_trgm on public.products using gin (name gin_trgm_ops);
create index products_extra_barcodes_idx on public.products using gin (extra_barcodes);

create trigger products_set_updated_at
  before update on public.products
  for each row execute function app.set_updated_at();

-- Product variants -----------------------------------------------------------
create table public.product_variants (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  product_id    uuid not null references public.products(id) on delete cascade,
  sku           text,
  barcode       text,
  attributes    jsonb not null default '{}'::jsonb,    -- {"size":"M","color":"red"}
  price_override        numeric(14,4),
  purchase_price_override numeric(14,4),
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id) on delete set null,
  updated_by    uuid references auth.users(id) on delete set null,
  unique (tenant_id, sku),
  unique (tenant_id, barcode)
);

create index product_variants_product_idx on public.product_variants (product_id);
create index product_variants_tenant_idx on public.product_variants (tenant_id);

create trigger product_variants_set_updated_at
  before update on public.product_variants
  for each row execute function app.set_updated_at();

-- Per-branch settings --------------------------------------------------------
create table public.product_branch_settings (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  product_id      uuid not null references public.products(id) on delete cascade,
  branch_id       uuid not null references public.branches(id) on delete cascade,
  is_active       boolean not null default true,
  min_stock       numeric(14,4) not null default 0,
  max_stock       numeric(14,4),
  reorder_qty     numeric(14,4),
  lead_time_days  integer,
  branch_price    numeric(14,4),       -- override for this branch only
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (product_id, branch_id)
);

create index product_branch_settings_tenant_idx on public.product_branch_settings (tenant_id);
create index product_branch_settings_branch_idx on public.product_branch_settings (branch_id);

create trigger product_branch_settings_set_updated_at
  before update on public.product_branch_settings
  for each row execute function app.set_updated_at();

-- Batches (per product if batch_tracking=true) -------------------------------
create table public.batches (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  product_id        uuid not null references public.products(id) on delete cascade,
  variant_id        uuid references public.product_variants(id) on delete set null,
  lot_no            text not null,
  manufacture_date  date,
  expiry_date       date,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (product_id, lot_no)
);

create index batches_tenant_idx on public.batches (tenant_id);
create index batches_product_idx on public.batches (product_id);
create index batches_expiry_idx on public.batches (tenant_id, expiry_date) where expiry_date is not null;

create trigger batches_set_updated_at
  before update on public.batches
  for each row execute function app.set_updated_at();

-- Price history (audit of selling/purchase price changes) --------------------
create table public.product_price_history (
  id            bigserial primary key,
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  product_id    uuid not null references public.products(id) on delete cascade,
  field         text not null,                          -- 'selling_price' | 'purchase_price'
  old_value     numeric(14,4),
  new_value     numeric(14,4),
  changed_by    uuid references auth.users(id) on delete set null,
  changed_at    timestamptz not null default now()
);

create index product_price_history_product_idx on public.product_price_history (product_id, changed_at desc);

-- Trigger: record price changes
create or replace function app.record_product_price_change() returns trigger
language plpgsql as $$
begin
  if (new.selling_price is distinct from old.selling_price) then
    insert into public.product_price_history (tenant_id, product_id, field, old_value, new_value, changed_by)
    values (new.tenant_id, new.id, 'selling_price', old.selling_price, new.selling_price, new.updated_by);
  end if;
  if (new.purchase_price is distinct from old.purchase_price) then
    insert into public.product_price_history (tenant_id, product_id, field, old_value, new_value, changed_by)
    values (new.tenant_id, new.id, 'purchase_price', old.purchase_price, new.purchase_price, new.updated_by);
  end if;
  return new;
end;
$$;

create trigger products_price_change
  after update on public.products
  for each row execute function app.record_product_price_change();

-- >>> 20260517100400_init_suppliers_and_purchasing.sql
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

-- >>> 20260517100500_init_inventory.sql
-- =============================================================================
-- ShopOS - Step 4 - Migration 06: Stock ledger + balances + adjustments
-- =============================================================================
--
-- Design summary:
-- - stock_ledger is APPEND-ONLY. Corrections are compensating rows.
-- - stock_balances is a derived snapshot, kept in sync transactionally
--   with ledger inserts (but always rebuildable from the ledger as truth).
-- =============================================================================

-- Stock ledger (immutable) ----------------------------------------------------
create table public.stock_ledger (
  id                 bigserial primary key,
  tenant_id          uuid not null references public.tenants(id) on delete cascade,
  branch_id          uuid not null references public.branches(id) on delete restrict,

  product_id         uuid not null references public.products(id) on delete restrict,
  variant_id         uuid references public.product_variants(id) on delete set null,
  batch_id           uuid references public.batches(id) on delete set null,

  movement_type      public.stock_movement_type not null,
  from_state         public.stock_state,
  to_state           public.stock_state,
  quantity           numeric(14,4) not null,            -- positive number; direction encoded by from/to states
  unit_cost          numeric(14,4),                     -- cost at time of movement (for COGS)

  reference_type     text,                              -- 'sale','goods_receipt','adjustment','transfer','return','online_order'
  reference_id       uuid,
  related_movement_id bigint references public.stock_ledger(id) on delete set null,

  note               text,
  user_id            uuid references auth.users(id) on delete set null,
  created_at         timestamptz not null default now()
);

create index stock_ledger_tenant_idx on public.stock_ledger (tenant_id);
create index stock_ledger_product_idx on public.stock_ledger (tenant_id, product_id, branch_id, created_at desc);
create index stock_ledger_branch_idx on public.stock_ledger (branch_id, created_at desc);
create index stock_ledger_reference_idx on public.stock_ledger (reference_type, reference_id);
create index stock_ledger_movement_type_idx on public.stock_ledger (tenant_id, movement_type, created_at desc);

-- Block updates and deletes (append-only)
create or replace function app.block_ledger_modifications() returns trigger
language plpgsql as $$
begin
  raise exception 'stock_ledger is append-only; use compensating rows for corrections';
end;
$$;

create trigger stock_ledger_no_update
  before update on public.stock_ledger
  for each row execute function app.block_ledger_modifications();

create trigger stock_ledger_no_delete
  before delete on public.stock_ledger
  for each row execute function app.block_ledger_modifications();

comment on table public.stock_ledger is 'Append-only journal of every stock movement.';

-- Stock balances (derived) ----------------------------------------------------
create table public.stock_balances (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  branch_id     uuid not null references public.branches(id) on delete cascade,
  product_id    uuid not null references public.products(id) on delete cascade,
  variant_id    uuid references public.product_variants(id) on delete cascade,
  state         public.stock_state not null,
  quantity      numeric(14,4) not null default 0,
  updated_at    timestamptz not null default now(),
  unique (tenant_id, branch_id, product_id, variant_id, state)
);

create index stock_balances_tenant_idx on public.stock_balances (tenant_id);
create index stock_balances_lookup_idx on public.stock_balances (tenant_id, product_id, branch_id, state);
create index stock_balances_low_stock_idx on public.stock_balances (tenant_id, branch_id, product_id) where state = 'available';

create trigger stock_balances_set_updated_at
  before update on public.stock_balances
  for each row execute function app.set_updated_at();

comment on table public.stock_balances is 'Per (tenant, branch, product, variant, state) running quantity. Rebuildable from stock_ledger.';

-- =============================================================================
-- Stock movement RPCs
-- =============================================================================
--
-- Use these RPCs from server actions to write to the ledger AND update
-- balances atomically. Direct INSERTs into stock_ledger are blocked by RLS
-- for non-service roles (see RLS migration), but we keep this RPC pattern
-- so the application logic stays consistent.
-- =============================================================================

create or replace function app.apply_stock_movement(
  p_tenant_id        uuid,
  p_branch_id        uuid,
  p_product_id       uuid,
  p_variant_id       uuid,
  p_batch_id         uuid,
  p_movement_type    public.stock_movement_type,
  p_from_state       public.stock_state,
  p_to_state         public.stock_state,
  p_quantity         numeric,
  p_unit_cost        numeric,
  p_reference_type   text,
  p_reference_id     uuid,
  p_user_id          uuid,
  p_note             text default null
) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_ledger_id bigint;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'apply_stock_movement: quantity must be positive (got %)', p_quantity;
  end if;

  -- 1. Insert ledger row
  insert into public.stock_ledger (
    tenant_id, branch_id, product_id, variant_id, batch_id,
    movement_type, from_state, to_state, quantity, unit_cost,
    reference_type, reference_id, user_id, note
  ) values (
    p_tenant_id, p_branch_id, p_product_id, p_variant_id, p_batch_id,
    p_movement_type, p_from_state, p_to_state, p_quantity, p_unit_cost,
    p_reference_type, p_reference_id, p_user_id, p_note
  ) returning id into v_ledger_id;

  -- 2. Decrement source state if any
  if p_from_state is not null then
    insert into public.stock_balances (tenant_id, branch_id, product_id, variant_id, state, quantity)
    values (p_tenant_id, p_branch_id, p_product_id, p_variant_id, p_from_state, -p_quantity)
    on conflict (tenant_id, branch_id, product_id, variant_id, state)
    do update set quantity = public.stock_balances.quantity - p_quantity,
                  updated_at = now();
  end if;

  -- 3. Increment destination state if any
  if p_to_state is not null then
    insert into public.stock_balances (tenant_id, branch_id, product_id, variant_id, state, quantity)
    values (p_tenant_id, p_branch_id, p_product_id, p_variant_id, p_to_state, p_quantity)
    on conflict (tenant_id, branch_id, product_id, variant_id, state)
    do update set quantity = public.stock_balances.quantity + p_quantity,
                  updated_at = now();
  end if;

  return v_ledger_id;
end;
$$;

comment on function app.apply_stock_movement is 'Atomically write to stock_ledger and update stock_balances.';

-- =============================================================================
-- Stock adjustments (manager-approved corrections)
-- =============================================================================

create table public.stock_adjustments (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  branch_id     uuid not null references public.branches(id) on delete restrict,
  product_id    uuid not null references public.products(id) on delete restrict,
  variant_id    uuid references public.product_variants(id) on delete set null,
  state         public.stock_state not null default 'available',
  delta         numeric(14,4) not null,                -- can be negative
  reason        text not null,
  status        text not null default 'pending',       -- pending | approved | rejected
  requested_by  uuid references auth.users(id) on delete set null,
  approved_by   uuid references auth.users(id) on delete set null,
  approved_at   timestamptz,
  applied_ledger_id bigint references public.stock_ledger(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index stock_adjustments_tenant_idx on public.stock_adjustments (tenant_id);
create index stock_adjustments_branch_idx on public.stock_adjustments (branch_id);
create index stock_adjustments_status_idx on public.stock_adjustments (tenant_id, status);

create trigger stock_adjustments_set_updated_at
  before update on public.stock_adjustments
  for each row execute function app.set_updated_at();

-- >>> 20260517100600_init_pos_and_sales.sql
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

-- >>> 20260517100700_init_customers_and_audit.sql
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

-- >>> 20260517109000_init_rls.sql
-- =============================================================================
-- ShopOS - Step 4 - Migration 99: Row-Level Security policies
-- =============================================================================
--
-- Conventions:
-- - Every tenant-scoped table has RLS enabled.
-- - The default policy is: allow IFF the row's tenant_id is one of the
--   tenants the auth user belongs to (active membership).
-- - Stricter writes (e.g. price changes) are gated by has_tenant_role().
-- - Super admins (our company staff) get an "all access" policy on the
--   handful of tables we need to support customers; we still record
--   impersonation in audit_logs from the application layer.
-- - Inserts of stock_ledger / payments / sales are usually done via
--   server actions using the service-role key; these tables get
--   read-only RLS for tenant users.
--
-- Helper aliases (defined in 100000_init_extensions_and_helpers.sql):
--   app.current_user_id()
--   app.current_user_tenant_ids()
--   app.has_tenant_role(p_tenant_id uuid, roles_in text[])
--   app.is_super_admin()
-- =============================================================================

-- ----------------------------------------------------------------------------
-- 1. Enable RLS everywhere
-- ----------------------------------------------------------------------------
alter table public.tenants                  enable row level security;
alter table public.branches                 enable row level security;
alter table public.profiles                 enable row level security;
alter table public.user_tenants             enable row level security;

alter table public.categories               enable row level security;
alter table public.brands                   enable row level security;
alter table public.products                 enable row level security;
alter table public.product_variants         enable row level security;
alter table public.product_branch_settings  enable row level security;
alter table public.batches                  enable row level security;
alter table public.product_price_history    enable row level security;

alter table public.suppliers                enable row level security;
alter table public.purchase_orders          enable row level security;
alter table public.purchase_order_items     enable row level security;
alter table public.goods_receipts           enable row level security;
alter table public.goods_receipt_items      enable row level security;

alter table public.stock_ledger             enable row level security;
alter table public.stock_balances           enable row level security;
alter table public.stock_adjustments        enable row level security;

alter table public.pos_terminals            enable row level security;
alter table public.pos_sessions             enable row level security;
alter table public.cash_drawer_movements    enable row level security;
alter table public.sales                    enable row level security;
alter table public.sale_items               enable row level security;
alter table public.payments                 enable row level security;
alter table public.discounts                enable row level security;

alter table public.customers                enable row level security;

alter table public.audit_logs               enable row level security;
alter table public.notifications            enable row level security;
alter table public.idempotency_keys         enable row level security;
alter table public.outbox                   enable row level security;

-- ----------------------------------------------------------------------------
-- 2. Profiles: a user can read/update their own profile
-- ----------------------------------------------------------------------------
create policy profiles_self_select on public.profiles
  for select using (id = app.current_user_id() or app.is_super_admin());
create policy profiles_self_update on public.profiles
  for update using (id = app.current_user_id())
                with check (id = app.current_user_id());
create policy profiles_self_insert on public.profiles
  for insert with check (id = app.current_user_id());

-- ----------------------------------------------------------------------------
-- 3. Tenants: members can read; super admins can read all
-- ----------------------------------------------------------------------------
create policy tenants_member_select on public.tenants
  for select using (
    id in (select app.current_user_tenant_ids())
    or app.is_super_admin()
  );

create policy tenants_owner_update on public.tenants
  for update using (
    app.has_tenant_role(id, array['owner']::text[])
    or app.is_super_admin()
  );

-- Tenant creation is performed by the service role (provisioning flow).
-- We do not grant INSERT to authenticated users directly here.

-- ----------------------------------------------------------------------------
-- 4. user_tenants: read your own + tenant admins read theirs
-- ----------------------------------------------------------------------------
create policy user_tenants_self_select on public.user_tenants
  for select using (user_id = app.current_user_id() or app.is_super_admin());

create policy user_tenants_admin_select on public.user_tenants
  for select using (
    app.has_tenant_role(tenant_id, array['owner','manager']::text[])
  );

create policy user_tenants_admin_write on public.user_tenants
  for all using (
    app.has_tenant_role(tenant_id, array['owner']::text[])
    or app.is_super_admin()
  )
  with check (
    app.has_tenant_role(tenant_id, array['owner']::text[])
    or app.is_super_admin()
  );

-- ----------------------------------------------------------------------------
-- 5. Generic per-table tenant policies
--    Macro pattern: SELECT to all members, write to staff roles.
-- ----------------------------------------------------------------------------

-- Branches
create policy branches_member_select on public.branches
  for select using (tenant_id in (select app.current_user_tenant_ids()) or app.is_super_admin());
create policy branches_owner_write on public.branches
  for all using (app.has_tenant_role(tenant_id, array['owner','manager']::text[]) or app.is_super_admin())
        with check (app.has_tenant_role(tenant_id, array['owner','manager']::text[]) or app.is_super_admin());

-- Categories / brands
create policy categories_member_select on public.categories
  for select using (tenant_id in (select app.current_user_tenant_ids()) or app.is_super_admin());
create policy categories_staff_write on public.categories
  for all using (app.has_tenant_role(tenant_id, array['owner','manager']::text[]) or app.is_super_admin())
        with check (app.has_tenant_role(tenant_id, array['owner','manager']::text[]) or app.is_super_admin());

create policy brands_member_select on public.brands
  for select using (tenant_id in (select app.current_user_tenant_ids()) or app.is_super_admin());
create policy brands_staff_write on public.brands
  for all using (app.has_tenant_role(tenant_id, array['owner','manager']::text[]) or app.is_super_admin())
        with check (app.has_tenant_role(tenant_id, array['owner','manager']::text[]) or app.is_super_admin());

-- Products
create policy products_member_select on public.products
  for select using (tenant_id in (select app.current_user_tenant_ids()) or app.is_super_admin());
create policy products_staff_write on public.products
  for all using (app.has_tenant_role(tenant_id, array['owner','manager','warehouse']::text[]) or app.is_super_admin())
        with check (app.has_tenant_role(tenant_id, array['owner','manager','warehouse']::text[]) or app.is_super_admin());

create policy product_variants_member_select on public.product_variants
  for select using (tenant_id in (select app.current_user_tenant_ids()) or app.is_super_admin());
create policy product_variants_staff_write on public.product_variants
  for all using (app.has_tenant_role(tenant_id, array['owner','manager','warehouse']::text[]) or app.is_super_admin())
        with check (app.has_tenant_role(tenant_id, array['owner','manager','warehouse']::text[]) or app.is_super_admin());

create policy product_branch_settings_member_select on public.product_branch_settings
  for select using (tenant_id in (select app.current_user_tenant_ids()) or app.is_super_admin());
create policy product_branch_settings_staff_write on public.product_branch_settings
  for all using (app.has_tenant_role(tenant_id, array['owner','manager']::text[]) or app.is_super_admin())
        with check (app.has_tenant_role(tenant_id, array['owner','manager']::text[]) or app.is_super_admin());

create policy batches_member_select on public.batches
  for select using (tenant_id in (select app.current_user_tenant_ids()) or app.is_super_admin());
create policy batches_staff_write on public.batches
  for all using (app.has_tenant_role(tenant_id, array['owner','manager','warehouse']::text[]) or app.is_super_admin())
        with check (app.has_tenant_role(tenant_id, array['owner','manager','warehouse']::text[]) or app.is_super_admin());

create policy product_price_history_member_select on public.product_price_history
  for select using (tenant_id in (select app.current_user_tenant_ids()) or app.is_super_admin());

-- Suppliers
create policy suppliers_member_select on public.suppliers
  for select using (tenant_id in (select app.current_user_tenant_ids()) or app.is_super_admin());
create policy suppliers_staff_write on public.suppliers
  for all using (app.has_tenant_role(tenant_id, array['owner','manager','warehouse']::text[]) or app.is_super_admin())
        with check (app.has_tenant_role(tenant_id, array['owner','manager','warehouse']::text[]) or app.is_super_admin());

-- Purchase orders + items
create policy po_member_select on public.purchase_orders
  for select using (tenant_id in (select app.current_user_tenant_ids()) or app.is_super_admin());
create policy po_staff_write on public.purchase_orders
  for all using (app.has_tenant_role(tenant_id, array['owner','manager','warehouse']::text[]) or app.is_super_admin())
        with check (app.has_tenant_role(tenant_id, array['owner','manager','warehouse']::text[]) or app.is_super_admin());

create policy po_items_member_select on public.purchase_order_items
  for select using (tenant_id in (select app.current_user_tenant_ids()) or app.is_super_admin());
create policy po_items_staff_write on public.purchase_order_items
  for all using (app.has_tenant_role(tenant_id, array['owner','manager','warehouse']::text[]) or app.is_super_admin())
        with check (app.has_tenant_role(tenant_id, array['owner','manager','warehouse']::text[]) or app.is_super_admin());

create policy gr_member_select on public.goods_receipts
  for select using (tenant_id in (select app.current_user_tenant_ids()) or app.is_super_admin());
create policy gr_staff_write on public.goods_receipts
  for all using (app.has_tenant_role(tenant_id, array['owner','manager','warehouse']::text[]) or app.is_super_admin())
        with check (app.has_tenant_role(tenant_id, array['owner','manager','warehouse']::text[]) or app.is_super_admin());

create policy gr_items_member_select on public.goods_receipt_items
  for select using (tenant_id in (select app.current_user_tenant_ids()) or app.is_super_admin());
create policy gr_items_staff_write on public.goods_receipt_items
  for all using (app.has_tenant_role(tenant_id, array['owner','manager','warehouse']::text[]) or app.is_super_admin())
        with check (app.has_tenant_role(tenant_id, array['owner','manager','warehouse']::text[]) or app.is_super_admin());

-- Inventory: stock_ledger is read-only for tenant users (writes go through service role)
create policy stock_ledger_member_select on public.stock_ledger
  for select using (tenant_id in (select app.current_user_tenant_ids()) or app.is_super_admin());

create policy stock_balances_member_select on public.stock_balances
  for select using (tenant_id in (select app.current_user_tenant_ids()) or app.is_super_admin());

create policy stock_adjustments_member_select on public.stock_adjustments
  for select using (tenant_id in (select app.current_user_tenant_ids()) or app.is_super_admin());
create policy stock_adjustments_staff_write on public.stock_adjustments
  for all using (app.has_tenant_role(tenant_id, array['owner','manager','warehouse']::text[]) or app.is_super_admin())
        with check (app.has_tenant_role(tenant_id, array['owner','manager','warehouse']::text[]) or app.is_super_admin());

-- POS terminals + sessions
create policy pos_terminals_member_select on public.pos_terminals
  for select using (tenant_id in (select app.current_user_tenant_ids()) or app.is_super_admin());
create policy pos_terminals_staff_write on public.pos_terminals
  for all using (app.has_tenant_role(tenant_id, array['owner','manager']::text[]) or app.is_super_admin())
        with check (app.has_tenant_role(tenant_id, array['owner','manager']::text[]) or app.is_super_admin());

create policy pos_sessions_member_select on public.pos_sessions
  for select using (tenant_id in (select app.current_user_tenant_ids()) or app.is_super_admin());
create policy pos_sessions_cashier_write on public.pos_sessions
  for all using (app.has_tenant_role(tenant_id, array['owner','manager','cashier']::text[]) or app.is_super_admin())
        with check (app.has_tenant_role(tenant_id, array['owner','manager','cashier']::text[]) or app.is_super_admin());

create policy cash_movements_member_select on public.cash_drawer_movements
  for select using (tenant_id in (select app.current_user_tenant_ids()) or app.is_super_admin());
create policy cash_movements_cashier_write on public.cash_drawer_movements
  for insert with check (app.has_tenant_role(tenant_id, array['owner','manager','cashier']::text[]) or app.is_super_admin());

-- Sales / sale_items / payments are read-only for tenant users.
-- Writes go through server actions using the service role, so the
-- ledger and audit log are guaranteed to stay in sync.
create policy sales_member_select on public.sales
  for select using (tenant_id in (select app.current_user_tenant_ids()) or app.is_super_admin());
create policy sale_items_member_select on public.sale_items
  for select using (tenant_id in (select app.current_user_tenant_ids()) or app.is_super_admin());
create policy payments_member_select on public.payments
  for select using (tenant_id in (select app.current_user_tenant_ids()) or app.is_super_admin());

create policy discounts_member_select on public.discounts
  for select using (tenant_id in (select app.current_user_tenant_ids()) or app.is_super_admin());
create policy discounts_staff_write on public.discounts
  for all using (app.has_tenant_role(tenant_id, array['owner','manager']::text[]) or app.is_super_admin())
        with check (app.has_tenant_role(tenant_id, array['owner','manager']::text[]) or app.is_super_admin());

-- Customers
create policy customers_member_select on public.customers
  for select using (tenant_id in (select app.current_user_tenant_ids()) or app.is_super_admin());
create policy customers_staff_write on public.customers
  for all using (app.has_tenant_role(tenant_id, array['owner','manager','cashier','accountant']::text[]) or app.is_super_admin())
        with check (app.has_tenant_role(tenant_id, array['owner','manager','cashier','accountant']::text[]) or app.is_super_admin());

-- Audit logs: read for owners / accountants / support; insert by anyone within their tenant
create policy audit_logs_member_select on public.audit_logs
  for select using (
    tenant_id in (select app.current_user_tenant_ids())
    or app.is_super_admin()
  );
create policy audit_logs_member_insert on public.audit_logs
  for insert with check (
    tenant_id in (select app.current_user_tenant_ids())
    or app.is_super_admin()
  );

-- Notifications: per-user read; tenant staff can write tenant-wide ones
create policy notifications_self_select on public.notifications
  for select using (
    user_id = app.current_user_id()
    or (tenant_id in (select app.current_user_tenant_ids()) and user_id is null)
    or app.is_super_admin()
  );
create policy notifications_self_update on public.notifications
  for update using (user_id = app.current_user_id())
        with check (user_id = app.current_user_id());

-- Idempotency keys / outbox: server-only writes; tenant members can read their own
create policy idempotency_member_select on public.idempotency_keys
  for select using (tenant_id in (select app.current_user_tenant_ids()) or app.is_super_admin());

create policy outbox_member_select on public.outbox
  for select using (
    tenant_id is null
    or tenant_id in (select app.current_user_tenant_ids())
    or app.is_super_admin()
  );

-- >>> 20260517110000_init_onboarding_rpc.sql
-- =============================================================================
-- ShopOS - Step 6 - Migration: tenant onboarding RPC
-- =============================================================================
-- Exposes a single SECURITY DEFINER function that atomically:
--   1. inserts a new public.tenants row (slug auto-suffixed if needed)
--   2. inserts the first public.branches row for that tenant
--   3. inserts the calling auth user into public.user_tenants as 'owner'
--
-- This bypasses RLS deliberately so a brand-new authenticated user can
-- bootstrap their own tenant without granting them broad INSERT permissions.
-- The function returns the new tenant id, branch id, and final slug.
--
-- The function is in the `public` schema because Supabase only exposes
-- functions in `public` (and `graphql_public`) via PostgREST RPC by default.
-- =============================================================================

create or replace function public.create_tenant_with_owner(
  p_legal_name           text,
  p_display_name         text,
  p_slug                 text,
  p_vat_number           text default null,
  p_country              text default 'IE',
  p_currency             text default 'EUR',
  p_timezone             text default 'Europe/Dublin',
  p_locale               text default 'en-IE',
  p_branch_code          text default 'MAIN',
  p_branch_name          text default null,
  p_branch_address_line1 text default null,
  p_branch_city          text default null,
  p_branch_county        text default null,
  p_branch_eircode       text default null
) returns table (tenant_id uuid, branch_id uuid, slug text)
language plpgsql security definer set search_path = '' as $$
declare
  v_user_id   uuid := auth.uid();
  v_tenant_id uuid;
  v_branch_id uuid;
  v_slug      text := lower(trim(coalesce(p_slug, '')));
  v_attempt   text;
  v_counter   int := 0;
  v_branch_name text;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if v_slug is null or length(v_slug) < 2 then
    raise exception 'slug must be at least 2 characters' using errcode = '22023';
  end if;

  -- One-tenant-per-onboarding: refuse if the caller already owns a tenant.
  -- Lets users create extra tenants only via a future "Add another shop" flow.
  if exists (
    select 1
    from public.user_tenants ut
    where ut.user_id = v_user_id
      and ut.is_active = true
  ) then
    raise exception 'caller already belongs to a tenant' using errcode = '42501';
  end if;

  -- Find a unique slug. Tenants.slug is citext so collision check is
  -- case-insensitive. We auto-suffix -1, -2, ... until we find a free one.
  v_attempt := v_slug;
  while exists (select 1 from public.tenants t where t.slug = v_attempt) loop
    v_counter := v_counter + 1;
    if v_counter > 100 then
      raise exception 'could not find a unique slug for %', v_slug;
    end if;
    v_attempt := v_slug || '-' || v_counter::text;
  end loop;

  -- Tenant
  insert into public.tenants (
    slug, legal_name, display_name, vat_number,
    country, currency, timezone, default_locale,
    status, trial_ends_at, created_by, updated_by
  ) values (
    v_attempt,
    trim(p_legal_name),
    trim(p_display_name),
    nullif(trim(coalesce(p_vat_number, '')), ''),
    coalesce(p_country, 'IE'),
    coalesce(p_currency, 'EUR'),
    coalesce(p_timezone, 'Europe/Dublin'),
    coalesce(p_locale, 'en-IE'),
    'trial',
    now() + interval '30 days',
    v_user_id, v_user_id
  )
  returning id into v_tenant_id;

  -- Branch
  v_branch_name := coalesce(nullif(trim(coalesce(p_branch_name, '')), ''), trim(p_display_name));
  insert into public.branches (
    tenant_id, code, name,
    address_line1, city, county, eircode,
    country, timezone, is_active, created_by, updated_by
  ) values (
    v_tenant_id,
    upper(coalesce(nullif(trim(coalesce(p_branch_code, '')), ''), 'MAIN')),
    v_branch_name,
    nullif(trim(coalesce(p_branch_address_line1, '')), ''),
    nullif(trim(coalesce(p_branch_city, '')), ''),
    nullif(trim(coalesce(p_branch_county, '')), ''),
    nullif(trim(coalesce(p_branch_eircode, '')), ''),
    coalesce(p_country, 'IE'),
    coalesce(p_timezone, 'Europe/Dublin'),
    true,
    v_user_id, v_user_id
  )
  returning id into v_branch_id;

  -- Ownership: caller becomes 'owner'. branch_id stays null so they have
  -- access to every branch under this tenant (per RLS policies in 109000).
  insert into public.user_tenants (
    user_id, tenant_id, role, branch_id, is_active, accepted_at
  ) values (
    v_user_id, v_tenant_id, 'owner', null, true, now()
  );

  return query select v_tenant_id, v_branch_id, v_attempt;
end;
$$;

comment on function public.create_tenant_with_owner is
  'Onboarding wizard: atomically create a tenant, first branch, and owner membership for auth.uid(). Returns (tenant_id, branch_id, slug). Slug is auto-suffixed if it collides.';

-- Lock down execution: anon must NOT be able to call this; only signed-in
-- users (`authenticated` role) can.
revoke execute on function public.create_tenant_with_owner(
  text, text, text, text, text, text, text, text, text, text, text, text, text, text
) from public;
revoke execute on function public.create_tenant_with_owner(
  text, text, text, text, text, text, text, text, text, text, text, text, text, text
) from anon;
grant execute on function public.create_tenant_with_owner(
  text, text, text, text, text, text, text, text, text, text, text, text, text, text
) to authenticated;

-- >>> 20260517120000_fix_price_history_trigger.sql
-- =============================================================================
-- ShopOS - Step 7 - Fix product price history trigger
-- =============================================================================
-- The product_price_history table has only a SELECT RLS policy (it's a
-- write-once audit table). Inserts come exclusively from the
-- app.record_product_price_change() trigger which runs as the calling user
-- (a tenant member). Without SECURITY DEFINER, the trigger's INSERT was
-- blocked by RLS the first time a user updated a product's price.
--
-- Switch the trigger function to SECURITY DEFINER so it can write to the
-- audit table while still preserving RLS for direct user writes (which we
-- never want to allow on this table).

create or replace function app.record_product_price_change() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.selling_price is distinct from old.selling_price) then
    insert into public.product_price_history (tenant_id, product_id, field, old_value, new_value, changed_by)
    values (new.tenant_id, new.id, 'selling_price', old.selling_price, new.selling_price, new.updated_by);
  end if;
  if (new.purchase_price is distinct from old.purchase_price) then
    insert into public.product_price_history (tenant_id, product_id, field, old_value, new_value, changed_by)
    values (new.tenant_id, new.id, 'purchase_price', old.purchase_price, new.purchase_price, new.updated_by);
  end if;
  return new;
end;
$$;

-- Restrict who can call the function directly (only the trigger should).
revoke execute on function app.record_product_price_change() from public;

-- >>> 20260517130000_init_pos_sale_rpc.sql
-- =============================================================================
-- ShopOS - Step 8 - POS sale RPC + supporting helpers
-- =============================================================================
--
-- This migration adds:
--   * receipt_counters     - per (tenant, branch) sequential receipt counter
--   * app.next_receipt_number(...)        - locks + increments + formats
--   * app.ensure_open_pos_session(...)    - returns or auto-creates a session
--   * public.commit_pos_sale(...)         - atomic sale: header + items +
--                                            payments + stock ledger writes +
--                                            cash drawer movements
--
-- All write operations happen in one transaction. On any error the whole
-- thing is rolled back, so we never end up with a half-recorded sale.
-- =============================================================================

-- 1. Receipt counters --------------------------------------------------------

create table public.receipt_counters (
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  branch_id   uuid not null references public.branches(id) on delete cascade,
  last_seq    bigint not null default 0,
  updated_at  timestamptz not null default now(),
  primary key (tenant_id, branch_id)
);

alter table public.receipt_counters enable row level security;

-- read-only for tenant members; writes happen only via the SECURITY DEFINER RPC
create policy receipt_counters_member_select on public.receipt_counters
  for select using (tenant_id in (select app.current_user_tenant_ids()) or app.is_super_admin());

-- 2. Receipt number helper --------------------------------------------------

create or replace function app.next_receipt_number(
  p_tenant_id uuid,
  p_branch_id uuid,
  p_branch_code text
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_seq bigint;
  v_prefix text;
begin
  -- atomic counter increment
  insert into public.receipt_counters (tenant_id, branch_id, last_seq, updated_at)
  values (p_tenant_id, p_branch_id, 1, now())
  on conflict (tenant_id, branch_id)
  do update set last_seq = public.receipt_counters.last_seq + 1,
                updated_at = now()
  returning last_seq into v_seq;

  v_prefix := coalesce(nullif(p_branch_code, ''), 'SHOP');
  return v_prefix || '-' || to_char(v_seq, 'FM000000');
end;
$$;

revoke execute on function app.next_receipt_number(uuid, uuid, text) from public;

-- 3. Session helper: returns id of an open session for the cashier on the
-- branch, creating one with opening_cash = 0 if none exists. This is what
-- lets the POS work in Step 8 even before we ship the explicit till-open UI
-- (Step 9). When Step 9 ships, that UI just opens a session ahead of time
-- and this helper is a no-op fallback.

create or replace function app.ensure_open_pos_session(
  p_tenant_id   uuid,
  p_branch_id   uuid,
  p_terminal_id uuid,
  p_cashier_id  uuid
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_session_id uuid;
begin
  select id into v_session_id
  from public.pos_sessions
  where tenant_id = p_tenant_id
    and branch_id = p_branch_id
    and cashier_id = p_cashier_id
    and status = 'open'
  order by opened_at desc
  limit 1;

  if v_session_id is not null then
    return v_session_id;
  end if;

  insert into public.pos_sessions (tenant_id, branch_id, terminal_id, cashier_id, status, opening_cash)
  values (p_tenant_id, p_branch_id, p_terminal_id, p_cashier_id, 'open', 0)
  returning id into v_session_id;

  return v_session_id;
end;
$$;

revoke execute on function app.ensure_open_pos_session(uuid, uuid, uuid, uuid) from public;

-- 4. The atomic POS sale RPC ------------------------------------------------

create or replace function public.commit_pos_sale(
  p_branch_id    uuid,
  p_items        jsonb,                                  -- [{product_id, qty, discount?}]
  p_payments     jsonb,                                  -- [{method, amount, external_ref?, card_brand?, card_last4?}]
  p_terminal_id  uuid default null,
  p_session_id   uuid default null,
  p_customer_id  uuid default null,
  p_channel      public.sale_channel default 'pos',
  p_rounding     numeric default 0,
  p_notes        text default null
) returns table (
  sale_id        uuid,
  receipt_number text,
  total          numeric,
  vat_total      numeric,
  pos_session_id uuid
)
language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id     uuid := auth.uid();
  v_tenant_id   uuid;
  v_branch_code text;
  v_session_id  uuid;
  v_receipt_no  text;
  v_sale_id     uuid := gen_random_uuid();
  v_subtotal    numeric(14,4) := 0;     -- net of VAT (sum of all line nets)
  v_vat_total   numeric(14,4) := 0;
  v_total       numeric(14,4) := 0;
  v_discount    numeric(14,4) := 0;
  v_paid_total  numeric(14,4) := 0;
  v_breakdown   jsonb := '{}'::jsonb;
  v_item        jsonb;
  v_payment     jsonb;
  v_payments_arr jsonb;
  v_position    integer := 0;
  v_product     record;
  v_qty         numeric(14,4);
  v_unit_price  numeric(14,4);
  v_unit_cost   numeric(14,4);
  v_line_disc   numeric(14,4);
  v_vat_code    public.vat_code;
  v_vat_rate    numeric(6,4);
  v_vat_incl    boolean;
  v_line_gross  numeric(14,4);
  v_line_net    numeric(14,4);
  v_line_vat    numeric(14,4);
  v_existing    jsonb;
  v_method      public.payment_method;
  v_amount      numeric(14,4);
  v_pay_id      uuid;
begin
  ----------------------------------------------------------------------------
  -- 1. Authorisation + tenant resolution
  ----------------------------------------------------------------------------
  if v_user_id is null then
    raise exception 'commit_pos_sale: must be authenticated' using errcode = '42501';
  end if;

  select tenant_id, code into v_tenant_id, v_branch_code
  from public.branches
  where id = p_branch_id;

  if v_tenant_id is null then
    raise exception 'commit_pos_sale: branch not found' using errcode = '23503';
  end if;

  -- caller must be a staff member of this tenant
  if not app.has_tenant_role(v_tenant_id, array['owner','manager','cashier','warehouse']::text[])
     and not app.is_super_admin() then
    raise exception 'commit_pos_sale: not a staff member of this tenant' using errcode = '42501';
  end if;

  ----------------------------------------------------------------------------
  -- 2. Validate input shapes
  ----------------------------------------------------------------------------
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'commit_pos_sale: items must be a non-empty array';
  end if;

  if p_payments is null or jsonb_typeof(p_payments) <> 'array' or jsonb_array_length(p_payments) = 0 then
    raise exception 'commit_pos_sale: payments must be a non-empty array';
  end if;

  ----------------------------------------------------------------------------
  -- 3. Resolve POS session (auto-open if needed)
  ----------------------------------------------------------------------------
  if p_session_id is not null then
    perform 1 from public.pos_sessions
     where id = p_session_id and tenant_id = v_tenant_id and branch_id = p_branch_id;
    if not found then
      raise exception 'commit_pos_sale: invalid session id for this branch';
    end if;
    v_session_id := p_session_id;
  else
    v_session_id := app.ensure_open_pos_session(v_tenant_id, p_branch_id, p_terminal_id, v_user_id);
  end if;

  ----------------------------------------------------------------------------
  -- 4. Receipt number (locked + atomic)
  ----------------------------------------------------------------------------
  v_receipt_no := app.next_receipt_number(v_tenant_id, p_branch_id, v_branch_code);

  ----------------------------------------------------------------------------
  -- 5. Insert sale header (totals filled in after items pass)
  ----------------------------------------------------------------------------
  insert into public.sales (
    id, tenant_id, branch_id, pos_session_id, terminal_id, cashier_id,
    customer_id, channel, status, receipt_number, notes,
    subtotal, discount_total, vat_total, total, rounding, vat_breakdown,
    created_by
  ) values (
    v_sale_id, v_tenant_id, p_branch_id, v_session_id, p_terminal_id, v_user_id,
    p_customer_id, p_channel, 'completed', v_receipt_no, p_notes,
    0, 0, 0, 0, coalesce(p_rounding, 0), '{}'::jsonb,
    v_user_id
  );

  ----------------------------------------------------------------------------
  -- 6. Insert line items + stock movements
  ----------------------------------------------------------------------------
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_position := v_position + 1;
    v_qty := (v_item->>'qty')::numeric(14,4);
    v_line_disc := coalesce((v_item->>'discount')::numeric(14,4), 0);

    if v_qty is null or v_qty <= 0 then
      raise exception 'commit_pos_sale: qty must be positive (item %)', v_position;
    end if;
    if v_line_disc < 0 then
      raise exception 'commit_pos_sale: discount must be >= 0 (item %)', v_position;
    end if;

    -- load product (server-side source of truth for price + VAT)
    select id, name, sku, selling_price, purchase_price, vat_code, vat_included, base_unit
      into v_product
      from public.products
     where id = (v_item->>'product_id')::uuid
       and tenant_id = v_tenant_id;
    if not found then
      raise exception 'commit_pos_sale: product % not found in this tenant', v_item->>'product_id';
    end if;

    v_unit_price := v_product.selling_price;
    v_unit_cost  := v_product.purchase_price;
    v_vat_code   := v_product.vat_code;
    v_vat_incl   := v_product.vat_included;

    -- IE rates as of 2025/2026
    v_vat_rate := case v_vat_code
      when 'STD' then 0.23
      when 'RED' then 0.135
      when 'SEC' then 0.09
      when 'LIV' then 0.048
      when 'ZER' then 0.0
      when 'EXE' then 0.0
    end;

    if v_vat_incl then
      v_line_gross := round(v_unit_price * v_qty, 4) - v_line_disc;
      if v_line_gross < 0 then
        raise exception 'commit_pos_sale: discount exceeds line gross (item %)', v_position;
      end if;
      v_line_net := round(v_line_gross / (1 + v_vat_rate), 4);
      v_line_vat := round(v_line_gross - v_line_net, 4);
    else
      v_line_net := round(v_unit_price * v_qty, 4) - v_line_disc;
      if v_line_net < 0 then
        raise exception 'commit_pos_sale: discount exceeds line net (item %)', v_position;
      end if;
      v_line_vat := round(v_line_net * v_vat_rate, 4);
      v_line_gross := round(v_line_net + v_line_vat, 4);
    end if;

    insert into public.sale_items (
      tenant_id, sale_id, product_id, position,
      name_snapshot, sku_snapshot, quantity, unit_price, unit_cost,
      vat_code, vat_rate, discount,
      line_total_gross, line_total_net, line_vat
    ) values (
      v_tenant_id, v_sale_id, v_product.id, v_position,
      v_product.name, v_product.sku, v_qty, v_unit_price, v_unit_cost,
      v_vat_code, v_vat_rate, v_line_disc,
      v_line_gross, v_line_net, v_line_vat
    );

    -- stock movement: available -> (gone, to_state=NULL)
    perform app.apply_stock_movement(
      v_tenant_id, p_branch_id, v_product.id, null, null,
      'pos_sale', 'available'::public.stock_state, null,
      v_qty, v_unit_cost,
      'sale', v_sale_id, v_user_id, null
    );

    -- aggregate totals
    v_subtotal := v_subtotal + v_line_net;
    v_vat_total := v_vat_total + v_line_vat;
    v_total := v_total + v_line_gross;
    v_discount := v_discount + v_line_disc;

    -- vat_breakdown: { "STD": { rate, base, vat }, ... }
    v_existing := coalesce(v_breakdown->v_vat_code::text, jsonb_build_object('rate', v_vat_rate, 'base', 0, 'vat', 0));
    v_breakdown := jsonb_set(
      v_breakdown,
      array[v_vat_code::text],
      jsonb_build_object(
        'rate', v_vat_rate,
        'base', round(((v_existing->>'base')::numeric + v_line_net), 4),
        'vat',  round(((v_existing->>'vat')::numeric  + v_line_vat), 4)
      ),
      true
    );
  end loop;

  -- factor in rounding
  v_total := round(v_total + coalesce(p_rounding, 0), 2);

  ----------------------------------------------------------------------------
  -- 7. Insert payments + cash drawer movements
  ----------------------------------------------------------------------------
  v_payments_arr := p_payments;
  for v_payment in select * from jsonb_array_elements(v_payments_arr) loop
    v_method := (v_payment->>'method')::public.payment_method;
    v_amount := (v_payment->>'amount')::numeric(14,4);

    if v_amount is null or v_amount <= 0 then
      raise exception 'commit_pos_sale: payment amount must be positive (got %)', v_amount;
    end if;

    insert into public.payments (
      tenant_id, sale_id, method, amount, status,
      external_ref, card_brand, card_last4, captured_at, created_by
    ) values (
      v_tenant_id, v_sale_id, v_method, v_amount, 'captured',
      v_payment->>'external_ref',
      v_payment->>'card_brand',
      v_payment->>'card_last4',
      now(), v_user_id
    ) returning id into v_pay_id;

    if v_method = 'cash' then
      insert into public.cash_drawer_movements (
        tenant_id, pos_session_id, type, amount, reason,
        reference_type, reference_id, user_id
      ) values (
        v_tenant_id, v_session_id, 'sale', v_amount, 'POS sale',
        'sale', v_sale_id, v_user_id
      );
    end if;

    v_paid_total := v_paid_total + v_amount;
  end loop;

  ----------------------------------------------------------------------------
  -- 8. Validate paid >= total (small tolerance for cash rounding)
  ----------------------------------------------------------------------------
  if v_paid_total + 0.005 < v_total then
    raise exception 'commit_pos_sale: paid (%) is less than total (%)', v_paid_total, v_total
      using errcode = '22023';
  end if;

  ----------------------------------------------------------------------------
  -- 9. Update sale header with computed totals
  ----------------------------------------------------------------------------
  update public.sales
     set subtotal       = round(v_subtotal, 2),
         discount_total = round(v_discount, 2),
         vat_total      = round(v_vat_total, 2),
         total          = v_total,
         vat_breakdown  = v_breakdown
   where id = v_sale_id;

  ----------------------------------------------------------------------------
  -- 10. Return tuple to caller
  ----------------------------------------------------------------------------
  return query
    select v_sale_id, v_receipt_no, v_total, round(v_vat_total, 2), v_session_id;
end;
$$;

revoke execute on function public.commit_pos_sale(
  uuid, jsonb, jsonb, uuid, uuid, uuid, public.sale_channel, numeric, text
) from anon, public;

grant execute on function public.commit_pos_sale(
  uuid, jsonb, jsonb, uuid, uuid, uuid, public.sale_channel, numeric, text
) to authenticated;

-- >>> 20260517130100_fix_stock_balances_nulls.sql
-- =============================================================================
-- ShopOS - Step 8 - Fix: stock_balances unique key needs NULLS NOT DISTINCT
-- =============================================================================
--
-- The original constraint was `unique (tenant_id, branch_id, product_id,
-- variant_id, state)` which uses Postgres's default NULLS DISTINCT semantics.
-- That means two rows with variant_id IS NULL (i.e. the common case of a
-- product with no variants) are treated as DIFFERENT rows by the unique key,
-- so app.apply_stock_movement's `on conflict ... do update` never matches.
-- The result is duplicate balance rows being inserted instead of a single
-- running tally.
--
-- Fix: collapse any duplicates that already exist, then re-create the unique
-- constraint with NULLS NOT DISTINCT so NULL variant_id rows are coalesced.
-- =============================================================================

-- 1. Collapse any duplicate (tenant, branch, product, NULL variant, state)
-- rows into a single one before adding the stricter constraint. We use
-- (array_agg(id order by updated_at)) [1] because Postgres has no min(uuid).
with ranked as (
  select id,
         tenant_id, branch_id, product_id, state,
         sum(quantity) over w as total_qty,
         row_number() over w  as rn
    from public.stock_balances
   where variant_id is null
  window w as (
    partition by tenant_id, branch_id, product_id, state
    order by updated_at, id
  )
)
update public.stock_balances sb
   set quantity = r.total_qty,
       updated_at = now()
  from ranked r
 where sb.id = r.id
   and r.rn = 1
   and r.total_qty <> sb.quantity;

delete from public.stock_balances sb
 using (
   select id
     from (
       select id,
              row_number() over (
                partition by tenant_id, branch_id, product_id, state
                order by updated_at, id
              ) as rn
         from public.stock_balances
        where variant_id is null
     ) ranked
    where rn > 1
 ) dup
 where sb.id = dup.id;

-- 2. Drop the old unique constraint and add the NULLS NOT DISTINCT version.
alter table public.stock_balances
  drop constraint if exists stock_balances_tenant_id_branch_id_product_id_variant_id_st_key;

alter table public.stock_balances
  add constraint stock_balances_unique_loc
  unique nulls not distinct (tenant_id, branch_id, product_id, variant_id, state);

comment on constraint stock_balances_unique_loc on public.stock_balances is
  'NULL variant_id is treated as equal so apply_stock_movement upserts a single row per (tenant,branch,product,state) for products without variants.';

-- >>> 20260517140000_init_pos_session_rpcs.sql
-- =============================================================================
-- ShopOS - Step 9 - POS sessions: explicit open / close + cash movements
-- =============================================================================
--
-- Adds three SECURITY DEFINER RPCs:
--   public.open_pos_session(branch_id, opening_cash, terminal_id?, note?)
--   public.close_pos_session(session_id, counted_cash, closing_note?)
--   public.record_cash_movement(session_id, type, amount, reason?)
--
-- Also re-defines public.commit_pos_sale so that, when the caller passes a
-- session_id, the sale is rejected if that session is already closed.
--
-- The opening cash float is stored on the pos_sessions row (opening_cash).
-- We ALSO insert a cash_drawer_movements row of type 'opening' with the
-- same amount so the till tape shows it as the first movement. The
-- expected_cash is computed at close from cash_drawer_movements only:
--
--   expected = sum(amount where type in (opening, sale, pay_in))
--            - sum(amount where type in (refund_out, cash_drop, expense, pay_out, closing))
--
-- cash_difference is a generated column on pos_sessions
-- (counted_cash - expected_cash); positive = surplus, negative = shortage.
-- =============================================================================

-- 1. Open a till session ----------------------------------------------------

create or replace function public.open_pos_session(
  p_branch_id    uuid,
  p_opening_cash numeric default 0,
  p_terminal_id  uuid    default null,
  p_note         text    default null
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id    uuid := auth.uid();
  v_tenant_id  uuid;
  v_existing   uuid;
  v_session_id uuid;
  v_clean_note text;
begin
  if v_user_id is null then
    raise exception 'open_pos_session: must be authenticated' using errcode = '42501';
  end if;

  if p_opening_cash is null or p_opening_cash < 0 then
    raise exception 'open_pos_session: opening_cash must be >= 0';
  end if;

  select tenant_id into v_tenant_id from public.branches where id = p_branch_id;
  if v_tenant_id is null then
    raise exception 'open_pos_session: branch not found' using errcode = '23503';
  end if;

  if not app.has_tenant_role(v_tenant_id, array['owner','manager','cashier','warehouse']::text[])
     and not app.is_super_admin() then
    raise exception 'open_pos_session: not a staff member of this tenant' using errcode = '42501';
  end if;

  -- one open session per (cashier, branch) at a time
  select id into v_existing
    from public.pos_sessions
   where tenant_id = v_tenant_id
     and branch_id = p_branch_id
     and cashier_id = v_user_id
     and status = 'open'
   limit 1;

  if v_existing is not null then
    raise exception 'open_pos_session: you already have an open till on this branch (id=%); close it before opening a new one', v_existing
      using errcode = '23505';
  end if;

  insert into public.pos_sessions (
    tenant_id, branch_id, terminal_id, cashier_id, status, opening_cash, opened_at
  ) values (
    v_tenant_id, p_branch_id, p_terminal_id, v_user_id, 'open', p_opening_cash, now()
  ) returning id into v_session_id;

  v_clean_note := nullif(trim(coalesce(p_note, '')), '');
  insert into public.cash_drawer_movements (
    tenant_id, pos_session_id, type, amount, reason, user_id
  ) values (
    v_tenant_id, v_session_id, 'opening', p_opening_cash, coalesce(v_clean_note, 'Opening float'), v_user_id
  );

  return v_session_id;
end;
$$;

revoke execute on function public.open_pos_session(uuid, numeric, uuid, text) from anon, public;
grant  execute on function public.open_pos_session(uuid, numeric, uuid, text) to authenticated;

-- 2. Record an arbitrary cash drawer movement ------------------------------

create or replace function public.record_cash_movement(
  p_session_id uuid,
  p_type       public.cash_movement_type,
  p_amount     numeric,
  p_reason     text default null
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id   uuid := auth.uid();
  v_session   record;
  v_id        uuid;
  v_clean     text;
begin
  if v_user_id is null then
    raise exception 'record_cash_movement: must be authenticated' using errcode = '42501';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'record_cash_movement: amount must be > 0';
  end if;

  if p_type in ('sale', 'refund_out') then
    raise exception 'record_cash_movement: % movements are written by the sale/refund flow, not by hand', p_type;
  end if;

  if p_type in ('opening', 'closing') then
    raise exception 'record_cash_movement: % movements are written by open/close, not by hand', p_type;
  end if;

  select * into v_session from public.pos_sessions where id = p_session_id;
  if v_session is null then
    raise exception 'record_cash_movement: session not found' using errcode = '23503';
  end if;

  if v_session.status <> 'open' then
    raise exception 'record_cash_movement: session is %, not open', v_session.status using errcode = '22023';
  end if;

  if v_session.cashier_id <> v_user_id
     and not app.has_tenant_role(v_session.tenant_id, array['owner','manager']::text[])
     and not app.is_super_admin() then
    raise exception 'record_cash_movement: only the cashier or a manager can record on this till' using errcode = '42501';
  end if;

  v_clean := nullif(trim(coalesce(p_reason, '')), '');

  insert into public.cash_drawer_movements (
    tenant_id, pos_session_id, type, amount, reason, user_id
  ) values (
    v_session.tenant_id, p_session_id, p_type, p_amount, v_clean, v_user_id
  ) returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.record_cash_movement(uuid, public.cash_movement_type, numeric, text) from anon, public;
grant  execute on function public.record_cash_movement(uuid, public.cash_movement_type, numeric, text) to authenticated;

-- 3. Close a till session ---------------------------------------------------

create or replace function public.close_pos_session(
  p_session_id   uuid,
  p_counted_cash numeric,
  p_closing_note text default null
) returns table (
  session_id      uuid,
  expected_cash   numeric,
  counted_cash    numeric,
  cash_difference numeric,
  status          public.pos_session_status
)
language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id    uuid := auth.uid();
  v_session    record;
  v_expected   numeric(14,4);
  v_clean_note text;
begin
  if v_user_id is null then
    raise exception 'close_pos_session: must be authenticated' using errcode = '42501';
  end if;

  if p_counted_cash is null or p_counted_cash < 0 then
    raise exception 'close_pos_session: counted_cash must be >= 0';
  end if;

  select * into v_session from public.pos_sessions where id = p_session_id;
  if v_session is null then
    raise exception 'close_pos_session: session not found' using errcode = '23503';
  end if;

  if v_session.status <> 'open' then
    raise exception 'close_pos_session: session is already %', v_session.status using errcode = '22023';
  end if;

  if v_session.cashier_id <> v_user_id
     and not app.has_tenant_role(v_session.tenant_id, array['owner','manager']::text[])
     and not app.is_super_admin() then
    raise exception 'close_pos_session: only the cashier or a manager can close this till' using errcode = '42501';
  end if;

  v_clean_note := nullif(trim(coalesce(p_closing_note, '')), '');

  -- compute expected cash from movements
  select coalesce(sum(case
           when type in ('opening', 'sale', 'pay_in') then amount
           when type in ('refund_out', 'cash_drop', 'expense', 'pay_out', 'closing') then -amount
           else 0
         end), 0)
    into v_expected
    from public.cash_drawer_movements
   where pos_session_id = p_session_id;

  update public.pos_sessions
     set status        = 'closed',
         closed_at     = now(),
         closed_by     = v_user_id,
         expected_cash = v_expected,
         counted_cash  = p_counted_cash,
         closing_note  = v_clean_note
   where id = p_session_id;

  return query
    select v_session.id,
           v_expected,
           p_counted_cash::numeric(14,4),
           (p_counted_cash::numeric(14,4) - v_expected)::numeric(14,4),
           'closed'::public.pos_session_status;
end;
$$;

revoke execute on function public.close_pos_session(uuid, numeric, text) from anon, public;
grant  execute on function public.close_pos_session(uuid, numeric, text) to authenticated;

-- 4. Tighten commit_pos_sale to reject closed sessions ---------------------
-- (Same body as Step 8; only the session validation block differs.)

create or replace function public.commit_pos_sale(
  p_branch_id    uuid,
  p_items        jsonb,
  p_payments     jsonb,
  p_terminal_id  uuid default null,
  p_session_id   uuid default null,
  p_customer_id  uuid default null,
  p_channel      public.sale_channel default 'pos',
  p_rounding     numeric default 0,
  p_notes        text default null
) returns table (
  sale_id        uuid,
  receipt_number text,
  total          numeric,
  vat_total      numeric,
  pos_session_id uuid
)
language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id     uuid := auth.uid();
  v_tenant_id   uuid;
  v_branch_code text;
  v_session_id  uuid;
  v_receipt_no  text;
  v_sale_id     uuid := gen_random_uuid();
  v_subtotal    numeric(14,4) := 0;
  v_vat_total   numeric(14,4) := 0;
  v_total       numeric(14,4) := 0;
  v_discount    numeric(14,4) := 0;
  v_paid_total  numeric(14,4) := 0;
  v_breakdown   jsonb := '{}'::jsonb;
  v_item        jsonb;
  v_payment     jsonb;
  v_payments_arr jsonb;
  v_position    integer := 0;
  v_product     record;
  v_qty         numeric(14,4);
  v_unit_price  numeric(14,4);
  v_unit_cost   numeric(14,4);
  v_line_disc   numeric(14,4);
  v_vat_code    public.vat_code;
  v_vat_rate    numeric(6,4);
  v_vat_incl    boolean;
  v_line_gross  numeric(14,4);
  v_line_net    numeric(14,4);
  v_line_vat    numeric(14,4);
  v_existing    jsonb;
  v_method      public.payment_method;
  v_amount      numeric(14,4);
  v_pay_id      uuid;
begin
  if v_user_id is null then
    raise exception 'commit_pos_sale: must be authenticated' using errcode = '42501';
  end if;

  select tenant_id, code into v_tenant_id, v_branch_code
    from public.branches
   where id = p_branch_id;

  if v_tenant_id is null then
    raise exception 'commit_pos_sale: branch not found' using errcode = '23503';
  end if;

  if not app.has_tenant_role(v_tenant_id, array['owner','manager','cashier','warehouse']::text[])
     and not app.is_super_admin() then
    raise exception 'commit_pos_sale: not a staff member of this tenant' using errcode = '42501';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'commit_pos_sale: items must be a non-empty array';
  end if;

  if p_payments is null or jsonb_typeof(p_payments) <> 'array' or jsonb_array_length(p_payments) = 0 then
    raise exception 'commit_pos_sale: payments must be a non-empty array';
  end if;

  -- session resolution: now requires the session to be OPEN if explicitly given
  if p_session_id is not null then
    perform 1 from public.pos_sessions
     where id = p_session_id
       and tenant_id = v_tenant_id
       and branch_id = p_branch_id
       and status = 'open';
    if not found then
      raise exception 'commit_pos_sale: session is not open or does not belong to this branch'
        using errcode = '22023';
    end if;
    v_session_id := p_session_id;
  else
    v_session_id := app.ensure_open_pos_session(v_tenant_id, p_branch_id, p_terminal_id, v_user_id);
  end if;

  v_receipt_no := app.next_receipt_number(v_tenant_id, p_branch_id, v_branch_code);

  insert into public.sales (
    id, tenant_id, branch_id, pos_session_id, terminal_id, cashier_id,
    customer_id, channel, status, receipt_number, notes,
    subtotal, discount_total, vat_total, total, rounding, vat_breakdown,
    created_by
  ) values (
    v_sale_id, v_tenant_id, p_branch_id, v_session_id, p_terminal_id, v_user_id,
    p_customer_id, p_channel, 'completed', v_receipt_no, p_notes,
    0, 0, 0, 0, coalesce(p_rounding, 0), '{}'::jsonb,
    v_user_id
  );

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_position := v_position + 1;
    v_qty := (v_item->>'qty')::numeric(14,4);
    v_line_disc := coalesce((v_item->>'discount')::numeric(14,4), 0);

    if v_qty is null or v_qty <= 0 then
      raise exception 'commit_pos_sale: qty must be positive (item %)', v_position;
    end if;
    if v_line_disc < 0 then
      raise exception 'commit_pos_sale: discount must be >= 0 (item %)', v_position;
    end if;

    select id, name, sku, selling_price, purchase_price, vat_code, vat_included, base_unit
      into v_product
      from public.products
     where id = (v_item->>'product_id')::uuid
       and tenant_id = v_tenant_id;
    if not found then
      raise exception 'commit_pos_sale: product % not found in this tenant', v_item->>'product_id';
    end if;

    v_unit_price := v_product.selling_price;
    v_unit_cost  := v_product.purchase_price;
    v_vat_code   := v_product.vat_code;
    v_vat_incl   := v_product.vat_included;

    v_vat_rate := case v_vat_code
      when 'STD' then 0.23
      when 'RED' then 0.135
      when 'SEC' then 0.09
      when 'LIV' then 0.048
      when 'ZER' then 0.0
      when 'EXE' then 0.0
    end;

    if v_vat_incl then
      v_line_gross := round(v_unit_price * v_qty, 4) - v_line_disc;
      if v_line_gross < 0 then
        raise exception 'commit_pos_sale: discount exceeds line gross (item %)', v_position;
      end if;
      v_line_net := round(v_line_gross / (1 + v_vat_rate), 4);
      v_line_vat := round(v_line_gross - v_line_net, 4);
    else
      v_line_net := round(v_unit_price * v_qty, 4) - v_line_disc;
      if v_line_net < 0 then
        raise exception 'commit_pos_sale: discount exceeds line net (item %)', v_position;
      end if;
      v_line_vat := round(v_line_net * v_vat_rate, 4);
      v_line_gross := round(v_line_net + v_line_vat, 4);
    end if;

    insert into public.sale_items (
      tenant_id, sale_id, product_id, position,
      name_snapshot, sku_snapshot, quantity, unit_price, unit_cost,
      vat_code, vat_rate, discount,
      line_total_gross, line_total_net, line_vat
    ) values (
      v_tenant_id, v_sale_id, v_product.id, v_position,
      v_product.name, v_product.sku, v_qty, v_unit_price, v_unit_cost,
      v_vat_code, v_vat_rate, v_line_disc,
      v_line_gross, v_line_net, v_line_vat
    );

    perform app.apply_stock_movement(
      v_tenant_id, p_branch_id, v_product.id, null, null,
      'pos_sale', 'available'::public.stock_state, null,
      v_qty, v_unit_cost,
      'sale', v_sale_id, v_user_id, null
    );

    v_subtotal := v_subtotal + v_line_net;
    v_vat_total := v_vat_total + v_line_vat;
    v_total := v_total + v_line_gross;
    v_discount := v_discount + v_line_disc;

    v_existing := coalesce(v_breakdown->v_vat_code::text, jsonb_build_object('rate', v_vat_rate, 'base', 0, 'vat', 0));
    v_breakdown := jsonb_set(
      v_breakdown,
      array[v_vat_code::text],
      jsonb_build_object(
        'rate', v_vat_rate,
        'base', round(((v_existing->>'base')::numeric + v_line_net), 4),
        'vat',  round(((v_existing->>'vat')::numeric  + v_line_vat), 4)
      ),
      true
    );
  end loop;

  v_total := round(v_total + coalesce(p_rounding, 0), 2);

  v_payments_arr := p_payments;
  for v_payment in select * from jsonb_array_elements(v_payments_arr) loop
    v_method := (v_payment->>'method')::public.payment_method;
    v_amount := (v_payment->>'amount')::numeric(14,4);

    if v_amount is null or v_amount <= 0 then
      raise exception 'commit_pos_sale: payment amount must be positive (got %)', v_amount;
    end if;

    insert into public.payments (
      tenant_id, sale_id, method, amount, status,
      external_ref, card_brand, card_last4, captured_at, created_by
    ) values (
      v_tenant_id, v_sale_id, v_method, v_amount, 'captured',
      v_payment->>'external_ref',
      v_payment->>'card_brand',
      v_payment->>'card_last4',
      now(), v_user_id
    ) returning id into v_pay_id;

    if v_method = 'cash' then
      insert into public.cash_drawer_movements (
        tenant_id, pos_session_id, type, amount, reason,
        reference_type, reference_id, user_id
      ) values (
        v_tenant_id, v_session_id, 'sale', v_amount, 'POS sale',
        'sale', v_sale_id, v_user_id
      );
    end if;

    v_paid_total := v_paid_total + v_amount;
  end loop;

  if v_paid_total + 0.005 < v_total then
    raise exception 'commit_pos_sale: paid (%) is less than total (%)', v_paid_total, v_total
      using errcode = '22023';
  end if;

  update public.sales
     set subtotal       = round(v_subtotal, 2),
         discount_total = round(v_discount, 2),
         vat_total      = round(v_vat_total, 2),
         total          = v_total,
         vat_breakdown  = v_breakdown
   where id = v_sale_id;

  return query
    select v_sale_id, v_receipt_no, v_total, round(v_vat_total, 2), v_session_id;
end;
$$;

-- >>> 20260517150000_init_purchasing_rpcs.sql
-- =============================================================================
-- ShopOS - Step 10 - Supplier receiving: PO + GR + weighted-average cost
-- =============================================================================
--
-- Adds:
--   * purchasing_counters         - per-tenant sequential counters for PO + GR
--   * app.next_purchasing_number  - locked + atomic counter increment
--   * public.create_purchase_order   - atomic header + items insert
--   * public.create_goods_receipt    - atomic header + items insert
--   * public.finalise_goods_receipt  - the heavy one. For each line:
--       - update product.purchase_price using weighted-average cost (WAC)
--       - apply_stock_movement (NULL -> available)
--       - increment matching purchase_order_items.qty_received
--     Then recomputes the PO status (partially_received / received) and
--     stamps the GR as 'finalised'.
-- =============================================================================

-- 1. Counters ---------------------------------------------------------------

create table public.purchasing_counters (
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  kind       text not null check (kind in ('po', 'gr')),
  last_seq   bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, kind)
);

alter table public.purchasing_counters enable row level security;

create policy purchasing_counters_member_select on public.purchasing_counters
  for select using (tenant_id in (select app.current_user_tenant_ids()) or app.is_super_admin());

create or replace function app.next_purchasing_number(
  p_tenant_id uuid,
  p_kind      text
) returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_seq    bigint;
  v_prefix text;
begin
  if p_kind not in ('po', 'gr') then
    raise exception 'next_purchasing_number: invalid kind %', p_kind;
  end if;

  insert into public.purchasing_counters (tenant_id, kind, last_seq, updated_at)
  values (p_tenant_id, p_kind, 1, now())
  on conflict (tenant_id, kind)
  do update set last_seq = public.purchasing_counters.last_seq + 1,
                updated_at = now()
  returning last_seq into v_seq;

  v_prefix := upper(p_kind);
  return v_prefix || '-' || to_char(v_seq, 'FM000000');
end;
$$;

revoke execute on function app.next_purchasing_number(uuid, text) from public;

-- 2. Create purchase order --------------------------------------------------

create or replace function public.create_purchase_order(
  p_branch_id   uuid,
  p_supplier_id uuid,
  p_items       jsonb,    -- [{product_id, quantity, unit_cost, vat_code?, notes?}]
  p_expected_at date    default null,
  p_notes       text    default null,
  p_currency    text    default 'EUR'
) returns table (
  po_id     uuid,
  po_number text,
  subtotal  numeric,
  vat_total numeric,
  total     numeric
)
language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id   uuid := auth.uid();
  v_tenant_id uuid;
  v_po_id     uuid := gen_random_uuid();
  v_po_number text;
  v_item      jsonb;
  v_position  integer := 0;
  v_subtotal  numeric(14,4) := 0;
  v_vat       numeric(14,4) := 0;
  v_total     numeric(14,4) := 0;
  v_qty       numeric(14,4);
  v_cost      numeric(14,4);
  v_vatcode   public.vat_code;
  v_vatrate   numeric(6,4);
  v_linenet   numeric(14,4);
  v_linevat   numeric(14,4);
  v_supplier_tenant uuid;
begin
  if v_user_id is null then
    raise exception 'create_purchase_order: must be authenticated' using errcode = '42501';
  end if;

  select tenant_id into v_tenant_id from public.branches where id = p_branch_id;
  if v_tenant_id is null then
    raise exception 'create_purchase_order: branch not found' using errcode = '23503';
  end if;

  if not app.has_tenant_role(v_tenant_id, array['owner','manager','warehouse']::text[])
     and not app.is_super_admin() then
    raise exception 'create_purchase_order: not authorised' using errcode = '42501';
  end if;

  -- supplier must belong to the same tenant
  select tenant_id into v_supplier_tenant from public.suppliers where id = p_supplier_id;
  if v_supplier_tenant is null or v_supplier_tenant <> v_tenant_id then
    raise exception 'create_purchase_order: supplier does not belong to this tenant'
      using errcode = '23503';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'create_purchase_order: items must be a non-empty array';
  end if;

  v_po_number := app.next_purchasing_number(v_tenant_id, 'po');

  insert into public.purchase_orders (
    id, tenant_id, branch_id, supplier_id, po_number, status,
    expected_at, notes, currency, created_by
  ) values (
    v_po_id, v_tenant_id, p_branch_id, p_supplier_id, v_po_number, 'draft',
    p_expected_at, p_notes, coalesce(p_currency, 'EUR'), v_user_id
  );

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_position := v_position + 1;
    v_qty  := (v_item->>'quantity')::numeric(14,4);
    v_cost := (v_item->>'unit_cost')::numeric(14,4);
    v_vatcode := coalesce((v_item->>'vat_code')::public.vat_code, 'STD');

    if v_qty is null or v_qty <= 0 then
      raise exception 'create_purchase_order: quantity must be > 0 (item %)', v_position;
    end if;
    if v_cost is null or v_cost < 0 then
      raise exception 'create_purchase_order: unit_cost must be >= 0 (item %)', v_position;
    end if;

    -- product must belong to this tenant
    perform 1 from public.products
     where id = (v_item->>'product_id')::uuid and tenant_id = v_tenant_id;
    if not found then
      raise exception 'create_purchase_order: product % not found in this tenant',
        v_item->>'product_id';
    end if;

    v_vatrate := case v_vatcode
      when 'STD' then 0.23
      when 'RED' then 0.135
      when 'SEC' then 0.09
      when 'LIV' then 0.048
      when 'ZER' then 0.0
      when 'EXE' then 0.0
    end;

    v_linenet := round(v_qty * v_cost, 4);
    v_linevat := round(v_linenet * v_vatrate, 4);

    insert into public.purchase_order_items (
      tenant_id, purchase_order_id, product_id, quantity, unit_cost,
      vat_code, notes, position
    ) values (
      v_tenant_id, v_po_id, (v_item->>'product_id')::uuid, v_qty, v_cost,
      v_vatcode, v_item->>'notes', v_position
    );

    v_subtotal := v_subtotal + v_linenet;
    v_vat      := v_vat      + v_linevat;
    v_total    := v_total    + v_linenet + v_linevat;
  end loop;

  update public.purchase_orders
     set subtotal  = round(v_subtotal, 2),
         vat_total = round(v_vat, 2),
         total     = round(v_total, 2)
   where id = v_po_id;

  return query select v_po_id, v_po_number, round(v_subtotal, 2), round(v_vat, 2), round(v_total, 2);
end;
$$;

revoke execute on function public.create_purchase_order(uuid, uuid, jsonb, date, text, text)
  from anon, public;
grant  execute on function public.create_purchase_order(uuid, uuid, jsonb, date, text, text)
  to authenticated;

-- 3. Create goods receipt ---------------------------------------------------

create or replace function public.create_goods_receipt(
  p_branch_id        uuid,
  p_supplier_id      uuid,
  p_items            jsonb,    -- [{product_id, quantity, unit_cost, vat_code?, expiry_date?, lot_no?, notes?}]
  p_purchase_order_id uuid    default null,
  p_invoice_number   text    default null,
  p_invoice_total    numeric default null,
  p_received_at      timestamptz default null,
  p_notes            text    default null
) returns table (
  gr_id     uuid,
  gr_number text
)
language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id   uuid := auth.uid();
  v_tenant_id uuid;
  v_gr_id     uuid := gen_random_uuid();
  v_gr_number text;
  v_item      jsonb;
  v_position  integer := 0;
  v_qty       numeric(14,4);
  v_cost      numeric(14,4);
  v_supplier_tenant uuid;
  v_po_tenant uuid;
  v_po_branch uuid;
begin
  if v_user_id is null then
    raise exception 'create_goods_receipt: must be authenticated' using errcode = '42501';
  end if;

  select tenant_id into v_tenant_id from public.branches where id = p_branch_id;
  if v_tenant_id is null then
    raise exception 'create_goods_receipt: branch not found' using errcode = '23503';
  end if;

  if not app.has_tenant_role(v_tenant_id, array['owner','manager','warehouse']::text[])
     and not app.is_super_admin() then
    raise exception 'create_goods_receipt: not authorised' using errcode = '42501';
  end if;

  select tenant_id into v_supplier_tenant from public.suppliers where id = p_supplier_id;
  if v_supplier_tenant is null or v_supplier_tenant <> v_tenant_id then
    raise exception 'create_goods_receipt: supplier does not belong to this tenant'
      using errcode = '23503';
  end if;

  if p_purchase_order_id is not null then
    select tenant_id, branch_id into v_po_tenant, v_po_branch
      from public.purchase_orders where id = p_purchase_order_id;
    if v_po_tenant is null or v_po_tenant <> v_tenant_id then
      raise exception 'create_goods_receipt: purchase order does not belong to this tenant';
    end if;
    if v_po_branch <> p_branch_id then
      raise exception 'create_goods_receipt: PO branch does not match receipt branch';
    end if;
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'create_goods_receipt: items must be a non-empty array';
  end if;

  v_gr_number := app.next_purchasing_number(v_tenant_id, 'gr');

  insert into public.goods_receipts (
    id, tenant_id, branch_id, supplier_id, purchase_order_id,
    gr_number, status, received_at,
    invoice_number, invoice_total, notes, created_by
  ) values (
    v_gr_id, v_tenant_id, p_branch_id, p_supplier_id, p_purchase_order_id,
    v_gr_number, 'draft', coalesce(p_received_at, now()),
    p_invoice_number, p_invoice_total, p_notes, v_user_id
  );

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_position := v_position + 1;
    v_qty  := (v_item->>'quantity')::numeric(14,4);
    v_cost := (v_item->>'unit_cost')::numeric(14,4);

    if v_qty is null or v_qty <= 0 then
      raise exception 'create_goods_receipt: quantity must be > 0 (item %)', v_position;
    end if;
    if v_cost is null or v_cost < 0 then
      raise exception 'create_goods_receipt: unit_cost must be >= 0 (item %)', v_position;
    end if;

    perform 1 from public.products
     where id = (v_item->>'product_id')::uuid and tenant_id = v_tenant_id;
    if not found then
      raise exception 'create_goods_receipt: product % not found in this tenant',
        v_item->>'product_id';
    end if;

    insert into public.goods_receipt_items (
      tenant_id, goods_receipt_id, product_id, quantity, unit_cost,
      vat_code, expiry_date, lot_no, notes, position
    ) values (
      v_tenant_id, v_gr_id, (v_item->>'product_id')::uuid, v_qty, v_cost,
      coalesce((v_item->>'vat_code')::public.vat_code, 'STD'),
      nullif(v_item->>'expiry_date', '')::date,
      v_item->>'lot_no',
      v_item->>'notes',
      v_position
    );
  end loop;

  return query select v_gr_id, v_gr_number;
end;
$$;

revoke execute on function public.create_goods_receipt(uuid, uuid, jsonb, uuid, text, numeric, timestamptz, text)
  from anon, public;
grant  execute on function public.create_goods_receipt(uuid, uuid, jsonb, uuid, text, numeric, timestamptz, text)
  to authenticated;

-- 4. Finalise goods receipt (THE big one) -----------------------------------
-- For each line: update WAC on product, write to stock_ledger + balances,
-- increment qty_received on the matching PO line, then recompute PO status.

create or replace function public.finalise_goods_receipt(
  p_gr_id uuid
) returns table (
  gr_id        uuid,
  gr_number    text,
  po_id        uuid,
  po_status    public.purchase_order_status,
  items_count  integer
)
language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id  uuid := auth.uid();
  v_gr       record;
  v_item     record;
  v_balance  numeric(14,4);
  v_old_cost numeric(14,4);
  v_new_cost numeric(14,4);
  v_count    integer := 0;
  v_po_id    uuid;
  v_po_received numeric(14,4);
  v_po_total    numeric(14,4);
  v_po_status   public.purchase_order_status;
begin
  if v_user_id is null then
    raise exception 'finalise_goods_receipt: must be authenticated' using errcode = '42501';
  end if;

  select * into v_gr from public.goods_receipts where id = p_gr_id;
  if not found then
    raise exception 'finalise_goods_receipt: receipt not found' using errcode = '23503';
  end if;

  if v_gr.status <> 'draft' then
    raise exception 'finalise_goods_receipt: receipt is %, not draft', v_gr.status
      using errcode = '22023';
  end if;

  if not app.has_tenant_role(v_gr.tenant_id, array['owner','manager','warehouse']::text[])
     and not app.is_super_admin() then
    raise exception 'finalise_goods_receipt: not authorised' using errcode = '42501';
  end if;

  -- Loop items in deterministic order
  for v_item in
    select gri.id, gri.product_id, gri.variant_id, gri.batch_id,
           gri.quantity, gri.unit_cost, gri.expiry_date, gri.lot_no,
           p.purchase_price as current_purchase_price,
           p.name as product_name
      from public.goods_receipt_items gri
      join public.products p on p.id = gri.product_id
     where gri.goods_receipt_id = p_gr_id
     order by gri.position
  loop
    v_count := v_count + 1;

    -- Current available stock (any branch? no - just THIS branch).
    select coalesce(sum(quantity), 0) into v_balance
      from public.stock_balances
     where tenant_id = v_gr.tenant_id
       and branch_id = v_gr.branch_id
       and product_id = v_item.product_id
       and variant_id is not distinct from v_item.variant_id
       and state = 'available';

    -- Weighted-average cost. If we had no stock at all, the new cost is
    -- simply the receipt unit cost.
    v_old_cost := coalesce(v_item.current_purchase_price, v_item.unit_cost);

    if v_balance + v_item.quantity > 0 then
      v_new_cost := round(
        (v_balance * v_old_cost + v_item.quantity * v_item.unit_cost)
        / (v_balance + v_item.quantity),
        4
      );
    else
      v_new_cost := v_item.unit_cost;
    end if;

    -- Update product master cost. (Variant-level cost is for later; for
    -- now we always update the product row.)
    update public.products
       set purchase_price = v_new_cost
     where id = v_item.product_id and tenant_id = v_gr.tenant_id;

    -- Apply the stock movement: NULL -> available (goods_receipt type).
    perform app.apply_stock_movement(
      v_gr.tenant_id, v_gr.branch_id, v_item.product_id, v_item.variant_id, v_item.batch_id,
      'goods_receipt', null, 'available'::public.stock_state,
      v_item.quantity, v_item.unit_cost,
      'goods_receipt', p_gr_id, v_user_id, v_gr.gr_number
    );
  end loop;

  -- If linked to a PO: increment qty_received on matching PO lines and
  -- recompute the PO status.
  v_po_id := v_gr.purchase_order_id;
  if v_po_id is not null then
    update public.purchase_order_items poi
       set qty_received = poi.qty_received + sub.received_qty,
           updated_at   = now()
      from (
        select product_id, sum(quantity) as received_qty
          from public.goods_receipt_items
         where goods_receipt_id = p_gr_id
         group by product_id
      ) sub
     where poi.purchase_order_id = v_po_id
       and poi.product_id        = sub.product_id;

    select coalesce(sum(qty_received), 0), coalesce(sum(quantity), 0)
      into v_po_received, v_po_total
      from public.purchase_order_items
     where purchase_order_id = v_po_id;

    if v_po_total > 0 and v_po_received >= v_po_total then
      v_po_status := 'received';
    elsif v_po_received > 0 then
      v_po_status := 'partially_received';
    else
      select status into v_po_status from public.purchase_orders where id = v_po_id;
    end if;

    update public.purchase_orders
       set status     = v_po_status,
           updated_at = now()
     where id = v_po_id;
  end if;

  -- Mark the GR as finalised
  update public.goods_receipts
     set status       = 'finalised',
         finalised_at = now(),
         finalised_by = v_user_id,
         updated_at   = now()
   where id = p_gr_id;

  return query select v_gr.id, v_gr.gr_number, v_po_id, v_po_status, v_count;
end;
$$;

revoke execute on function public.finalise_goods_receipt(uuid) from anon, public;
grant  execute on function public.finalise_goods_receipt(uuid) to authenticated;

-- >>> 20260517160000_init_audit_triggers.sql
-- =============================================================================
-- ShopOS - Step 12 - Audit triggers
-- =============================================================================
--
-- Adds a single generic SECURITY DEFINER trigger function that records every
-- row-level mutation on the most important business tables into
-- public.audit_logs. The trigger:
--
--   - serialises NEW (and OLD on UPDATE / DELETE) into jsonb, stripping the
--     noisy `updated_at` column so a row only logs when something the owner
--     cares about actually changed.
--   - emits a stable action of the form `<entity>.created|.updated|.deleted`,
--     where the entity prefix is passed as the trigger argument.
--   - resolves the tenant from the row itself (or the row id, when the
--     entity IS a tenant), so the audit row is automatically tenant-scoped.
--   - resolves the user from auth.uid(), which works correctly even when
--     the calling code is a SECURITY DEFINER RPC (e.g. commit_pos_sale).
--
-- Tables wired up here are the ones that materially affect inventory,
-- cash, customer data, or money flow:
--
--   tenants, branches, products, suppliers, categories, brands, customers,
--   purchase_orders, goods_receipts, pos_sessions, sales,
--   cash_drawer_movements, product_branch_settings
--
-- Tables explicitly NOT triggered (high-frequency or already audit-grade):
--   stock_ledger, stock_balances, sale_items, payments, purchase_order_items,
--   goods_receipt_items, audit_logs, product_price_history, profiles,
--   user_tenants, idempotency_keys, notifications, outbox
-- =============================================================================

create or replace function app.audit_row_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_entity     text  := tg_argv[0];
  v_action     text;
  v_before     jsonb := null;
  v_after      jsonb := null;
  v_row        jsonb;
  v_tenant_id  uuid;
  v_entity_id  uuid;
  v_user_id    uuid  := auth.uid();
begin
  if tg_op = 'INSERT' then
    v_after  := to_jsonb(new) - 'updated_at';
    v_action := v_entity || '.created';
    v_row    := to_jsonb(new);
  elsif tg_op = 'UPDATE' then
    v_before := to_jsonb(old) - 'updated_at';
    v_after  := to_jsonb(new) - 'updated_at';
    if v_before = v_after then
      -- Nothing meaningful changed (probably a touch of updated_at only).
      return new;
    end if;
    v_action := v_entity || '.updated';
    v_row    := to_jsonb(new);
  else
    v_before := to_jsonb(old) - 'updated_at';
    v_action := v_entity || '.deleted';
    v_row    := to_jsonb(old);
  end if;

  if v_entity = 'tenant' then
    -- The tenant row itself is the tenant context. On DELETE we leave
    -- tenant_id NULL because the FK target is gone and audit_logs.tenant_id
    -- has on delete cascade. The action + entity_id still record the event.
    if tg_op = 'DELETE' then
      v_tenant_id := null;
    else
      v_tenant_id := (v_row ->> 'id')::uuid;
    end if;
  else
    v_tenant_id := nullif(v_row ->> 'tenant_id', '')::uuid;
  end if;

  v_entity_id := nullif(v_row ->> 'id', '')::uuid;

  insert into public.audit_logs (
    tenant_id, user_id, action, entity_type, entity_id, before, after
  ) values (
    v_tenant_id, v_user_id, v_action, v_entity, v_entity_id, v_before, v_after
  );

  return coalesce(new, old);
end;
$$;

revoke execute on function app.audit_row_change() from public;

-- ---------------------------------------------------------------------------
-- Attach the trigger to every audited table.
-- ---------------------------------------------------------------------------

drop trigger if exists audit_tenants_change on public.tenants;
create trigger audit_tenants_change
  after insert or update or delete on public.tenants
  for each row execute function app.audit_row_change('tenant');

drop trigger if exists audit_branches_change on public.branches;
create trigger audit_branches_change
  after insert or update or delete on public.branches
  for each row execute function app.audit_row_change('branch');

drop trigger if exists audit_products_change on public.products;
create trigger audit_products_change
  after insert or update or delete on public.products
  for each row execute function app.audit_row_change('product');

drop trigger if exists audit_suppliers_change on public.suppliers;
create trigger audit_suppliers_change
  after insert or update or delete on public.suppliers
  for each row execute function app.audit_row_change('supplier');

drop trigger if exists audit_categories_change on public.categories;
create trigger audit_categories_change
  after insert or update or delete on public.categories
  for each row execute function app.audit_row_change('category');

drop trigger if exists audit_brands_change on public.brands;
create trigger audit_brands_change
  after insert or update or delete on public.brands
  for each row execute function app.audit_row_change('brand');

drop trigger if exists audit_customers_change on public.customers;
create trigger audit_customers_change
  after insert or update or delete on public.customers
  for each row execute function app.audit_row_change('customer');

drop trigger if exists audit_purchase_orders_change on public.purchase_orders;
create trigger audit_purchase_orders_change
  after insert or update or delete on public.purchase_orders
  for each row execute function app.audit_row_change('purchase_order');

drop trigger if exists audit_goods_receipts_change on public.goods_receipts;
create trigger audit_goods_receipts_change
  after insert or update or delete on public.goods_receipts
  for each row execute function app.audit_row_change('goods_receipt');

drop trigger if exists audit_pos_sessions_change on public.pos_sessions;
create trigger audit_pos_sessions_change
  after insert or update or delete on public.pos_sessions
  for each row execute function app.audit_row_change('pos_session');

drop trigger if exists audit_sales_change on public.sales;
create trigger audit_sales_change
  after insert or update or delete on public.sales
  for each row execute function app.audit_row_change('sale');

drop trigger if exists audit_cash_drawer_movements_change on public.cash_drawer_movements;
create trigger audit_cash_drawer_movements_change
  after insert or update or delete on public.cash_drawer_movements
  for each row execute function app.audit_row_change('cash_movement');

drop trigger if exists audit_product_branch_settings_change on public.product_branch_settings;
create trigger audit_product_branch_settings_change
  after insert or update or delete on public.product_branch_settings
  for each row execute function app.audit_row_change('product_branch_settings');

-- >>> 20260517170000_add_pos_sale_idempotency.sql
-- =============================================================================
-- ShopOS - Step 13 - Idempotent commit_pos_sale
-- =============================================================================
--
-- The offline POS queue can replay the SAME sale more than once: a flaky
-- network may have already accepted the sale before the response made
-- it back to the device, or the cashier may close + re-open the tab
-- before the queue flusher has finished. We must NEVER charge twice.
--
-- We add a new optional `p_client_uuid uuid` parameter. When supplied:
--   1. on entry, we look up `idempotency_keys` for that key + tenant.
--      If a cached response already exists, we return it verbatim without
--      doing any work.
--   2. on success, we cache the response so a subsequent replay is a
--      no-op.
--
-- The cache row lives in the existing `public.idempotency_keys` table
-- (Step 4). It expires after 24h (default), which is plenty of time for
-- the queue flusher to reconcile.
--
-- We DROP the previous 9-arg signature first because Postgres treats a
-- new default-value parameter as a brand new function.
-- =============================================================================

drop function if exists public.commit_pos_sale(
  uuid, jsonb, jsonb, uuid, uuid, uuid, public.sale_channel, numeric, text
);

create or replace function public.commit_pos_sale(
  p_branch_id    uuid,
  p_items        jsonb,
  p_payments     jsonb,
  p_terminal_id  uuid default null,
  p_session_id   uuid default null,
  p_customer_id  uuid default null,
  p_channel      public.sale_channel default 'pos',
  p_rounding     numeric default 0,
  p_notes        text default null,
  p_client_uuid  uuid default null
) returns table (
  sale_id        uuid,
  receipt_number text,
  total          numeric,
  vat_total      numeric,
  pos_session_id uuid
)
language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id     uuid := auth.uid();
  v_tenant_id   uuid;
  v_branch_code text;
  v_session_id  uuid;
  v_receipt_no  text;
  v_sale_id     uuid := gen_random_uuid();
  v_subtotal    numeric(14,4) := 0;
  v_vat_total   numeric(14,4) := 0;
  v_total       numeric(14,4) := 0;
  v_discount    numeric(14,4) := 0;
  v_paid_total  numeric(14,4) := 0;
  v_breakdown   jsonb := '{}'::jsonb;
  v_item        jsonb;
  v_payment     jsonb;
  v_payments_arr jsonb;
  v_position    integer := 0;
  v_product     record;
  v_qty         numeric(14,4);
  v_unit_price  numeric(14,4);
  v_unit_cost   numeric(14,4);
  v_line_disc   numeric(14,4);
  v_vat_code    public.vat_code;
  v_vat_rate    numeric(6,4);
  v_vat_incl    boolean;
  v_line_gross  numeric(14,4);
  v_line_net    numeric(14,4);
  v_line_vat    numeric(14,4);
  v_existing    jsonb;
  v_method      public.payment_method;
  v_amount      numeric(14,4);
  v_pay_id      uuid;
  v_idem        jsonb;
begin
  if v_user_id is null then
    raise exception 'commit_pos_sale: must be authenticated' using errcode = '42501';
  end if;

  select tenant_id, code into v_tenant_id, v_branch_code
    from public.branches
   where id = p_branch_id;

  if v_tenant_id is null then
    raise exception 'commit_pos_sale: branch not found' using errcode = '23503';
  end if;

  if not app.has_tenant_role(v_tenant_id, array['owner','manager','cashier','warehouse']::text[])
     and not app.is_super_admin() then
    raise exception 'commit_pos_sale: not a staff member of this tenant' using errcode = '42501';
  end if;

  -- ---------------------------------------------------------------------------
  -- Idempotency: short-circuit if we have a cached response for this client_uuid.
  -- ---------------------------------------------------------------------------
  if p_client_uuid is not null then
    select response_body into v_idem
      from public.idempotency_keys
     where key = p_client_uuid::text
       and tenant_id = v_tenant_id;
    if v_idem is not null then
      return query
        select
          (v_idem->>'sale_id')::uuid,
           v_idem->>'receipt_number',
          (v_idem->>'total')::numeric,
          (v_idem->>'vat_total')::numeric,
          (v_idem->>'pos_session_id')::uuid;
      return;
    end if;
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'commit_pos_sale: items must be a non-empty array';
  end if;

  if p_payments is null or jsonb_typeof(p_payments) <> 'array' or jsonb_array_length(p_payments) = 0 then
    raise exception 'commit_pos_sale: payments must be a non-empty array';
  end if;

  if p_session_id is not null then
    perform 1 from public.pos_sessions
     where id = p_session_id
       and tenant_id = v_tenant_id
       and branch_id = p_branch_id
       and status = 'open';
    if not found then
      raise exception 'commit_pos_sale: session is not open or does not belong to this branch'
        using errcode = '22023';
    end if;
    v_session_id := p_session_id;
  else
    v_session_id := app.ensure_open_pos_session(v_tenant_id, p_branch_id, p_terminal_id, v_user_id);
  end if;

  v_receipt_no := app.next_receipt_number(v_tenant_id, p_branch_id, v_branch_code);

  insert into public.sales (
    id, tenant_id, branch_id, pos_session_id, terminal_id, cashier_id,
    customer_id, channel, status, receipt_number, notes,
    subtotal, discount_total, vat_total, total, rounding, vat_breakdown,
    created_by
  ) values (
    v_sale_id, v_tenant_id, p_branch_id, v_session_id, p_terminal_id, v_user_id,
    p_customer_id, p_channel, 'completed', v_receipt_no, p_notes,
    0, 0, 0, 0, coalesce(p_rounding, 0), '{}'::jsonb,
    v_user_id
  );

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_position := v_position + 1;
    v_qty := (v_item->>'qty')::numeric(14,4);
    v_line_disc := coalesce((v_item->>'discount')::numeric(14,4), 0);

    if v_qty is null or v_qty <= 0 then
      raise exception 'commit_pos_sale: qty must be positive (item %)', v_position;
    end if;
    if v_line_disc < 0 then
      raise exception 'commit_pos_sale: discount must be >= 0 (item %)', v_position;
    end if;

    select id, name, sku, selling_price, purchase_price, vat_code, vat_included, base_unit
      into v_product
      from public.products
     where id = (v_item->>'product_id')::uuid
       and tenant_id = v_tenant_id;
    if not found then
      raise exception 'commit_pos_sale: product % not found in this tenant', v_item->>'product_id';
    end if;

    v_unit_price := v_product.selling_price;
    v_unit_cost  := v_product.purchase_price;
    v_vat_code   := v_product.vat_code;
    v_vat_incl   := v_product.vat_included;

    v_vat_rate := case v_vat_code
      when 'STD' then 0.23
      when 'RED' then 0.135
      when 'SEC' then 0.09
      when 'LIV' then 0.048
      when 'ZER' then 0.0
      when 'EXE' then 0.0
    end;

    if v_vat_incl then
      v_line_gross := round(v_unit_price * v_qty, 4) - v_line_disc;
      if v_line_gross < 0 then
        raise exception 'commit_pos_sale: discount exceeds line gross (item %)', v_position;
      end if;
      v_line_net := round(v_line_gross / (1 + v_vat_rate), 4);
      v_line_vat := round(v_line_gross - v_line_net, 4);
    else
      v_line_net := round(v_unit_price * v_qty, 4) - v_line_disc;
      if v_line_net < 0 then
        raise exception 'commit_pos_sale: discount exceeds line net (item %)', v_position;
      end if;
      v_line_vat := round(v_line_net * v_vat_rate, 4);
      v_line_gross := round(v_line_net + v_line_vat, 4);
    end if;

    insert into public.sale_items (
      tenant_id, sale_id, product_id, position,
      name_snapshot, sku_snapshot, quantity, unit_price, unit_cost,
      vat_code, vat_rate, discount,
      line_total_gross, line_total_net, line_vat
    ) values (
      v_tenant_id, v_sale_id, v_product.id, v_position,
      v_product.name, v_product.sku, v_qty, v_unit_price, v_unit_cost,
      v_vat_code, v_vat_rate, v_line_disc,
      v_line_gross, v_line_net, v_line_vat
    );

    perform app.apply_stock_movement(
      v_tenant_id, p_branch_id, v_product.id, null, null,
      'pos_sale', 'available'::public.stock_state, null,
      v_qty, v_unit_cost,
      'sale', v_sale_id, v_user_id, null
    );

    v_subtotal := v_subtotal + v_line_net;
    v_vat_total := v_vat_total + v_line_vat;
    v_total := v_total + v_line_gross;
    v_discount := v_discount + v_line_disc;

    v_existing := coalesce(v_breakdown->v_vat_code::text, jsonb_build_object('rate', v_vat_rate, 'base', 0, 'vat', 0));
    v_breakdown := jsonb_set(
      v_breakdown,
      array[v_vat_code::text],
      jsonb_build_object(
        'rate', v_vat_rate,
        'base', round(((v_existing->>'base')::numeric + v_line_net), 4),
        'vat',  round(((v_existing->>'vat')::numeric  + v_line_vat), 4)
      ),
      true
    );
  end loop;

  v_total := round(v_total + coalesce(p_rounding, 0), 2);

  v_payments_arr := p_payments;
  for v_payment in select * from jsonb_array_elements(v_payments_arr) loop
    v_method := (v_payment->>'method')::public.payment_method;
    v_amount := (v_payment->>'amount')::numeric(14,4);

    if v_amount is null or v_amount <= 0 then
      raise exception 'commit_pos_sale: payment amount must be positive (got %)', v_amount;
    end if;

    insert into public.payments (
      tenant_id, sale_id, method, amount, status,
      external_ref, card_brand, card_last4, captured_at, created_by
    ) values (
      v_tenant_id, v_sale_id, v_method, v_amount, 'captured',
      v_payment->>'external_ref',
      v_payment->>'card_brand',
      v_payment->>'card_last4',
      now(), v_user_id
    ) returning id into v_pay_id;

    if v_method = 'cash' then
      insert into public.cash_drawer_movements (
        tenant_id, pos_session_id, type, amount, reason,
        reference_type, reference_id, user_id
      ) values (
        v_tenant_id, v_session_id, 'sale', v_amount, 'POS sale',
        'sale', v_sale_id, v_user_id
      );
    end if;

    v_paid_total := v_paid_total + v_amount;
  end loop;

  if v_paid_total + 0.005 < v_total then
    raise exception 'commit_pos_sale: paid (%) is less than total (%)', v_paid_total, v_total
      using errcode = '22023';
  end if;

  update public.sales
     set subtotal       = round(v_subtotal, 2),
         discount_total = round(v_discount, 2),
         vat_total      = round(v_vat_total, 2),
         total          = v_total,
         vat_breakdown  = v_breakdown
   where id = v_sale_id;

  -- ---------------------------------------------------------------------------
  -- Cache the response under the idempotency key for safe replay.
  -- ---------------------------------------------------------------------------
  if p_client_uuid is not null then
    insert into public.idempotency_keys (
      key, tenant_id, user_id, response_body, status_code
    ) values (
      p_client_uuid::text, v_tenant_id, v_user_id,
      jsonb_build_object(
        'sale_id', v_sale_id,
        'receipt_number', v_receipt_no,
        'total', v_total,
        'vat_total', round(v_vat_total, 2),
        'pos_session_id', v_session_id
      ),
      201
    )
    on conflict (key) do nothing;
  end if;

  return query
    select v_sale_id, v_receipt_no, v_total, round(v_vat_total, 2), v_session_id;
end;
$$;

revoke execute on function public.commit_pos_sale(
  uuid, jsonb, jsonb, uuid, uuid, uuid, public.sale_channel, numeric, text, uuid
) from anon, public;

grant execute on function public.commit_pos_sale(
  uuid, jsonb, jsonb, uuid, uuid, uuid, public.sale_channel, numeric, text, uuid
) to authenticated;

-- >>> 20260604120000_pos_custom_price_override.sql
-- Allow POS cashiers to set a custom unit price on designated products (e.g. misc / one-off).

alter table public.products
  add column if not exists allow_pos_custom_price boolean not null default false;

comment on column public.products.allow_pos_custom_price is
  'When true, commit_pos_sale accepts an optional unit_price per line item (POS one-off sales).';

-- Re-define commit_pos_sale to honour optional unit_price on eligible products.
create or replace function public.commit_pos_sale(
  p_branch_id    uuid,
  p_items        jsonb,
  p_payments     jsonb,
  p_terminal_id  uuid default null,
  p_session_id   uuid default null,
  p_customer_id  uuid default null,
  p_channel      public.sale_channel default 'pos',
  p_rounding     numeric default 0,
  p_notes        text default null,
  p_client_uuid  uuid default null
) returns table (
  sale_id        uuid,
  receipt_number text,
  total          numeric,
  vat_total      numeric,
  pos_session_id uuid
)
language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id     uuid := auth.uid();
  v_tenant_id   uuid;
  v_branch_code text;
  v_session_id  uuid;
  v_receipt_no  text;
  v_sale_id     uuid := gen_random_uuid();
  v_subtotal    numeric(14,4) := 0;
  v_vat_total   numeric(14,4) := 0;
  v_total       numeric(14,4) := 0;
  v_discount    numeric(14,4) := 0;
  v_paid_total  numeric(14,4) := 0;
  v_breakdown   jsonb := '{}'::jsonb;
  v_item        jsonb;
  v_payment     jsonb;
  v_payments_arr jsonb;
  v_position    integer := 0;
  v_product     record;
  v_qty         numeric(14,4);
  v_unit_price  numeric(14,4);
  v_override    numeric(14,4);
  v_unit_cost   numeric(14,4);
  v_line_disc   numeric(14,4);
  v_vat_code    public.vat_code;
  v_vat_rate    numeric(6,4);
  v_vat_incl    boolean;
  v_line_gross  numeric(14,4);
  v_line_net    numeric(14,4);
  v_line_vat    numeric(14,4);
  v_existing    jsonb;
  v_method      public.payment_method;
  v_amount      numeric(14,4);
  v_pay_id      uuid;
  v_idem        jsonb;
begin
  if v_user_id is null then
    raise exception 'commit_pos_sale: must be authenticated' using errcode = '42501';
  end if;

  select tenant_id, code into v_tenant_id, v_branch_code
    from public.branches
   where id = p_branch_id;

  if v_tenant_id is null then
    raise exception 'commit_pos_sale: branch not found' using errcode = '23503';
  end if;

  if not app.has_tenant_role(v_tenant_id, array['owner','manager','cashier','warehouse']::text[])
     and not app.is_super_admin() then
    raise exception 'commit_pos_sale: not a staff member of this tenant' using errcode = '42501';
  end if;

  if p_client_uuid is not null then
    select response_body into v_idem
      from public.idempotency_keys
     where key = p_client_uuid::text
       and tenant_id = v_tenant_id;
    if v_idem is not null then
      return query
        select
          (v_idem->>'sale_id')::uuid,
           v_idem->>'receipt_number',
          (v_idem->>'total')::numeric,
          (v_idem->>'vat_total')::numeric,
          (v_idem->>'pos_session_id')::uuid;
      return;
    end if;
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'commit_pos_sale: items must be a non-empty array';
  end if;

  if p_payments is null or jsonb_typeof(p_payments) <> 'array' or jsonb_array_length(p_payments) = 0 then
    raise exception 'commit_pos_sale: payments must be a non-empty array';
  end if;

  if p_session_id is not null then
    perform 1 from public.pos_sessions
     where id = p_session_id
       and tenant_id = v_tenant_id
       and branch_id = p_branch_id
       and status = 'open';
    if not found then
      raise exception 'commit_pos_sale: session is not open or does not belong to this branch'
        using errcode = '22023';
    end if;
    v_session_id := p_session_id;
  else
    v_session_id := app.ensure_open_pos_session(v_tenant_id, p_branch_id, p_terminal_id, v_user_id);
  end if;

  v_receipt_no := app.next_receipt_number(v_tenant_id, p_branch_id, v_branch_code);

  insert into public.sales (
    id, tenant_id, branch_id, pos_session_id, terminal_id, cashier_id,
    customer_id, channel, status, receipt_number, notes,
    subtotal, discount_total, vat_total, total, rounding, vat_breakdown,
    created_by
  ) values (
    v_sale_id, v_tenant_id, p_branch_id, v_session_id, p_terminal_id, v_user_id,
    p_customer_id, p_channel, 'completed', v_receipt_no, p_notes,
    0, 0, 0, 0, coalesce(p_rounding, 0), '{}'::jsonb,
    v_user_id
  );

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_position := v_position + 1;
    v_qty := (v_item->>'qty')::numeric(14,4);
    v_line_disc := coalesce((v_item->>'discount')::numeric(14,4), 0);

    if v_qty is null or v_qty <= 0 then
      raise exception 'commit_pos_sale: qty must be positive (item %)', v_position;
    end if;
    if v_line_disc < 0 then
      raise exception 'commit_pos_sale: discount must be >= 0 (item %)', v_position;
    end if;

    select id, name, sku, selling_price, purchase_price, vat_code, vat_included, base_unit,
           allow_pos_custom_price
      into v_product
      from public.products
     where id = (v_item->>'product_id')::uuid
       and tenant_id = v_tenant_id;
    if not found then
      raise exception 'commit_pos_sale: product % not found in this tenant', v_item->>'product_id';
    end if;

    v_unit_price := v_product.selling_price;
    v_override := nullif(v_item->>'unit_price', '')::numeric(14,4);

    if v_override is not null then
      if not coalesce(v_product.allow_pos_custom_price, false) then
        raise exception 'commit_pos_sale: custom price not allowed for this product (item %)', v_position
          using errcode = '22023';
      end if;
      if v_override <= 0 or v_override > 99999 then
        raise exception 'commit_pos_sale: unit_price must be between 0.01 and 99999 (item %)', v_position
          using errcode = '22023';
      end if;
      v_unit_price := v_override;
    end if;

    v_unit_cost  := v_product.purchase_price;
    v_vat_code   := v_product.vat_code;
    v_vat_incl   := v_product.vat_included;

    v_vat_rate := case v_vat_code
      when 'STD' then 0.23
      when 'RED' then 0.135
      when 'SEC' then 0.09
      when 'LIV' then 0.048
      when 'ZER' then 0.0
      when 'EXE' then 0.0
    end;

    if v_vat_incl then
      v_line_gross := round(v_unit_price * v_qty, 4) - v_line_disc;
      if v_line_gross < 0 then
        raise exception 'commit_pos_sale: discount exceeds line gross (item %)', v_position;
      end if;
      v_line_net := round(v_line_gross / (1 + v_vat_rate), 4);
      v_line_vat := round(v_line_gross - v_line_net, 4);
    else
      v_line_net := round(v_unit_price * v_qty, 4) - v_line_disc;
      if v_line_net < 0 then
        raise exception 'commit_pos_sale: discount exceeds line net (item %)', v_position;
      end if;
      v_line_vat := round(v_line_net * v_vat_rate, 4);
      v_line_gross := round(v_line_net + v_line_vat, 4);
    end if;

    insert into public.sale_items (
      tenant_id, sale_id, product_id, position,
      name_snapshot, sku_snapshot, quantity, unit_price, unit_cost,
      vat_code, vat_rate, discount,
      line_total_gross, line_total_net, line_vat
    ) values (
      v_tenant_id, v_sale_id, v_product.id, v_position,
      v_product.name, v_product.sku, v_qty, v_unit_price, v_unit_cost,
      v_vat_code, v_vat_rate, v_line_disc,
      v_line_gross, v_line_net, v_line_vat
    );

    perform app.apply_stock_movement(
      v_tenant_id, p_branch_id, v_product.id, null, null,
      'pos_sale', 'available'::public.stock_state, null,
      v_qty, v_unit_cost,
      'sale', v_sale_id, v_user_id, null
    );

    v_subtotal := v_subtotal + v_line_net;
    v_vat_total := v_vat_total + v_line_vat;
    v_total := v_total + v_line_gross;
    v_discount := v_discount + v_line_disc;

    v_existing := coalesce(v_breakdown->v_vat_code::text, jsonb_build_object('rate', v_vat_rate, 'base', 0, 'vat', 0));
    v_breakdown := jsonb_set(
      v_breakdown,
      array[v_vat_code::text],
      jsonb_build_object(
        'rate', v_vat_rate,
        'base', round(((v_existing->>'base')::numeric + v_line_net), 4),
        'vat',  round(((v_existing->>'vat')::numeric  + v_line_vat), 4)
      ),
      true
    );
  end loop;

  v_total := round(v_total + coalesce(p_rounding, 0), 2);

  v_payments_arr := p_payments;
  for v_payment in select * from jsonb_array_elements(v_payments_arr) loop
    v_method := (v_payment->>'method')::public.payment_method;
    v_amount := (v_payment->>'amount')::numeric(14,4);

    if v_amount is null or v_amount <= 0 then
      raise exception 'commit_pos_sale: payment amount must be positive (got %)', v_amount;
    end if;

    insert into public.payments (
      tenant_id, sale_id, method, amount, status,
      external_ref, card_brand, card_last4, captured_at, created_by
    ) values (
      v_tenant_id, v_sale_id, v_method, v_amount, 'captured',
      v_payment->>'external_ref',
      v_payment->>'card_brand',
      v_payment->>'card_last4',
      now(), v_user_id
    ) returning id into v_pay_id;

    if v_method = 'cash' then
      insert into public.cash_drawer_movements (
        tenant_id, pos_session_id, type, amount, reason,
        reference_type, reference_id, user_id
      ) values (
        v_tenant_id, v_session_id, 'sale', v_amount, 'POS sale',
        'sale', v_sale_id, v_user_id
      );
    end if;

    v_paid_total := v_paid_total + v_amount;
  end loop;

  if v_paid_total + 0.005 < v_total then
    raise exception 'commit_pos_sale: paid (%) is less than total (%)', v_paid_total, v_total
      using errcode = '22023';
  end if;

  update public.sales
     set subtotal       = round(v_subtotal, 2),
         discount_total = round(v_discount, 2),
         vat_total      = round(v_vat_total, 2),
         total          = v_total,
         vat_breakdown  = v_breakdown
   where id = v_sale_id;

  if p_client_uuid is not null then
    insert into public.idempotency_keys (
      key, tenant_id, user_id, response_body, status_code
    ) values (
      p_client_uuid::text, v_tenant_id, v_user_id,
      jsonb_build_object(
        'sale_id', v_sale_id,
        'receipt_number', v_receipt_no,
        'total', v_total,
        'vat_total', round(v_vat_total, 2),
        'pos_session_id', v_session_id
      ),
      201
    )
    on conflict (key) do nothing;
  end if;

  return query
    select v_sale_id, v_receipt_no, v_total, round(v_vat_total, 2), v_session_id;
end;
$$;

-- >>> 20260604130000_apply_stock_adjustment_rpc.sql
-- Manual stock correction: set available quantity or apply a +/- delta at a branch.

create or replace function public.apply_stock_adjustment(
  p_branch_id      uuid,
  p_product_id     uuid,
  p_reason         text,
  p_delta          numeric default null,
  p_new_quantity   numeric default null
) returns table (
  adjustment_id uuid,
  previous_qty  numeric,
  new_qty       numeric
)
language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id      uuid := auth.uid();
  v_tenant_id    uuid;
  v_current      numeric(14,4) := 0;
  v_delta        numeric(14,4);
  v_ledger_id    bigint;
  v_adj_id       uuid := gen_random_uuid();
  v_unit_cost    numeric(14,4);
begin
  if v_user_id is null then
    raise exception 'apply_stock_adjustment: must be authenticated' using errcode = '42501';
  end if;

  if p_reason is null or length(trim(p_reason)) < 3 then
    raise exception 'apply_stock_adjustment: reason is required (min 3 characters)' using errcode = '22023';
  end if;

  select tenant_id into v_tenant_id
    from public.branches where id = p_branch_id;
  if v_tenant_id is null then
    raise exception 'apply_stock_adjustment: branch not found' using errcode = '23503';
  end if;

  if not app.has_tenant_role(v_tenant_id, array['owner','manager','warehouse']::text[])
     and not app.is_super_admin() then
    raise exception 'apply_stock_adjustment: not allowed for this role' using errcode = '42501';
  end if;

  perform 1 from public.products
   where id = p_product_id and tenant_id = v_tenant_id;
  if not found then
    raise exception 'apply_stock_adjustment: product not found' using errcode = '23503';
  end if;

  select coalesce(quantity, 0) into v_current
    from public.stock_balances
   where tenant_id = v_tenant_id
     and branch_id = p_branch_id
     and product_id = p_product_id
     and variant_id is null
     and state = 'available';

  if p_new_quantity is not null then
    if p_new_quantity < 0 then
      raise exception 'apply_stock_adjustment: new quantity cannot be negative' using errcode = '22023';
    end if;
    v_delta := round(p_new_quantity - coalesce(v_current, 0), 4);
  elsif p_delta is not null then
    v_delta := round(p_delta, 4);
  else
    raise exception 'apply_stock_adjustment: provide delta or new_quantity' using errcode = '22023';
  end if;

  if v_delta = 0 then
    return query select v_adj_id, coalesce(v_current, 0), coalesce(v_current, 0);
    return;
  end if;

  select purchase_price into v_unit_cost
    from public.products where id = p_product_id;

  insert into public.stock_adjustments (
    id, tenant_id, branch_id, product_id, variant_id, state,
    delta, reason, status, requested_by, approved_by, approved_at
  ) values (
    v_adj_id, v_tenant_id, p_branch_id, p_product_id, null, 'available',
    v_delta, trim(p_reason), 'approved', v_user_id, v_user_id, now()
  );

  if v_delta > 0 then
    v_ledger_id := app.apply_stock_movement(
      v_tenant_id, p_branch_id, p_product_id, null, null,
      'count_correction', null, 'available'::public.stock_state,
      v_delta, v_unit_cost,
      'adjustment', v_adj_id, v_user_id, trim(p_reason)
    );
  else
    if coalesce(v_current, 0) + v_delta < 0 then
      raise exception 'apply_stock_adjustment: cannot reduce below zero (on hand %, delta %)',
        coalesce(v_current, 0), v_delta using errcode = '22023';
    end if;
    v_ledger_id := app.apply_stock_movement(
      v_tenant_id, p_branch_id, p_product_id, null, null,
      'count_correction', 'available'::public.stock_state, null,
      abs(v_delta), v_unit_cost,
      'adjustment', v_adj_id, v_user_id, trim(p_reason)
    );
  end if;

  update public.stock_adjustments
     set applied_ledger_id = v_ledger_id
   where id = v_adj_id;

  select coalesce(quantity, 0) into v_current
    from public.stock_balances
   where tenant_id = v_tenant_id
     and branch_id = p_branch_id
     and product_id = p_product_id
     and variant_id is null
     and state = 'available';

  return query select v_adj_id, coalesce(v_current, 0) - v_delta, v_current;
end;
$$;

revoke execute on function public.apply_stock_adjustment(uuid, uuid, text, numeric, numeric) from anon, public;
grant execute on function public.apply_stock_adjustment(uuid, uuid, text, numeric, numeric) to authenticated;

-- >>> 20260604130100_apply_stock_adjustment_optional_reason.sql
-- Reason on manual stock adjustments is optional (defaults when blank).

create or replace function public.apply_stock_adjustment(
  p_branch_id      uuid,
  p_product_id     uuid,
  p_reason         text,
  p_delta          numeric default null,
  p_new_quantity   numeric default null
) returns table (
  adjustment_id uuid,
  previous_qty  numeric,
  new_qty       numeric
)
language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id      uuid := auth.uid();
  v_tenant_id    uuid;
  v_current      numeric(14,4) := 0;
  v_delta        numeric(14,4);
  v_ledger_id    bigint;
  v_adj_id       uuid := gen_random_uuid();
  v_unit_cost    numeric(14,4);
  v_reason       text;
begin
  if v_user_id is null then
    raise exception 'apply_stock_adjustment: must be authenticated' using errcode = '42501';
  end if;

  v_reason := coalesce(nullif(trim(p_reason), ''), 'Manual stock adjustment');

  select tenant_id into v_tenant_id
    from public.branches where id = p_branch_id;
  if v_tenant_id is null then
    raise exception 'apply_stock_adjustment: branch not found' using errcode = '23503';
  end if;

  if not app.has_tenant_role(v_tenant_id, array['owner','manager','warehouse']::text[])
     and not app.is_super_admin() then
    raise exception 'apply_stock_adjustment: not allowed for this role' using errcode = '42501';
  end if;

  perform 1 from public.products
   where id = p_product_id and tenant_id = v_tenant_id;
  if not found then
    raise exception 'apply_stock_adjustment: product not found' using errcode = '23503';
  end if;

  select coalesce(quantity, 0) into v_current
    from public.stock_balances
   where tenant_id = v_tenant_id
     and branch_id = p_branch_id
     and product_id = p_product_id
     and variant_id is null
     and state = 'available';

  if p_new_quantity is not null then
    if p_new_quantity < 0 then
      raise exception 'apply_stock_adjustment: new quantity cannot be negative' using errcode = '22023';
    end if;
    v_delta := round(p_new_quantity - coalesce(v_current, 0), 4);
  elsif p_delta is not null then
    v_delta := round(p_delta, 4);
  else
    raise exception 'apply_stock_adjustment: provide delta or new_quantity' using errcode = '22023';
  end if;

  if v_delta = 0 then
    return query select v_adj_id, coalesce(v_current, 0), coalesce(v_current, 0);
    return;
  end if;

  select purchase_price into v_unit_cost
    from public.products where id = p_product_id;

  insert into public.stock_adjustments (
    id, tenant_id, branch_id, product_id, variant_id, state,
    delta, reason, status, requested_by, approved_by, approved_at
  ) values (
    v_adj_id, v_tenant_id, p_branch_id, p_product_id, null, 'available',
    v_delta, v_reason, 'approved', v_user_id, v_user_id, now()
  );

  if v_delta > 0 then
    v_ledger_id := app.apply_stock_movement(
      v_tenant_id, p_branch_id, p_product_id, null, null,
      'count_correction', null, 'available'::public.stock_state,
      v_delta, v_unit_cost,
      'adjustment', v_adj_id, v_user_id, v_reason
    );
  else
    if coalesce(v_current, 0) + v_delta < 0 then
      raise exception 'apply_stock_adjustment: cannot reduce below zero (on hand %, delta %)',
        coalesce(v_current, 0), v_delta using errcode = '22023';
    end if;
    v_ledger_id := app.apply_stock_movement(
      v_tenant_id, p_branch_id, p_product_id, null, null,
      'count_correction', 'available'::public.stock_state, null,
      abs(v_delta), v_unit_cost,
      'adjustment', v_adj_id, v_user_id, v_reason
    );
  end if;

  update public.stock_adjustments
     set applied_ledger_id = v_ledger_id
   where id = v_adj_id;

  select coalesce(quantity, 0) into v_current
    from public.stock_balances
   where tenant_id = v_tenant_id
     and branch_id = p_branch_id
     and product_id = p_product_id
     and variant_id is null
     and state = 'available';

  return query select v_adj_id, coalesce(v_current, 0) - v_delta, v_current;
end;
$$;

-- >>> 20260604140000_product_images_storage.sql
-- Public bucket for product photos (tenant-scoped paths enforced in app layer).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy product_images_public_read on storage.objects
  for select
  using (bucket_id = 'product-images');

create policy product_images_authenticated_insert on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'product-images');

create policy product_images_authenticated_update on storage.objects
  for update
  to authenticated
  using (bucket_id = 'product-images');

create policy product_images_authenticated_delete on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'product-images');

-- >>> 20260604150000_online_store.sql
-- =============================================================================
-- ShopOS - Online storefront (per-tenant shop pages + shared stock)
-- =============================================================================

create type public.online_order_status as enum (
  'pending',      -- placed, awaiting confirmation / delivery
  'confirmed',
  'cancelled',
  'fulfilled'
);

-- One row per tenant; created automatically on onboarding (see backfill below).
create table public.tenant_storefronts (
  tenant_id              uuid primary key references public.tenants(id) on delete cascade,
  enabled                boolean not null default true,
  branch_id              uuid references public.branches(id) on delete set null,
  tagline                text,
  phone                  text,
  whatsapp               text,
  hero_title             text,
  hero_subtitle          text,
  order_notice           text,
  low_stock_threshold    integer not null default 5 check (low_stock_threshold >= 0),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create trigger tenant_storefronts_set_updated_at
  before update on public.tenant_storefronts
  for each row execute function app.set_updated_at();

comment on table public.tenant_storefronts is
  'Public online shop settings. URL: /shop/{tenants.slug}. Stock is taken from branch_id (or first active branch).';

alter table public.tenant_storefronts enable row level security;

create policy tenant_storefronts_member_select on public.tenant_storefronts
  for select using (
    tenant_id in (select app.current_user_tenant_ids()) or app.is_super_admin()
  );

create policy tenant_storefronts_owner_write on public.tenant_storefronts
  for all using (
    app.has_tenant_role(tenant_id, array['owner','manager']::text[]) or app.is_super_admin()
  )
  with check (
    app.has_tenant_role(tenant_id, array['owner','manager']::text[]) or app.is_super_admin()
  );

-- Sequential web order numbers per tenant ---------------------------------------
create table public.online_order_counters (
  tenant_id   uuid primary key references public.tenants(id) on delete cascade,
  last_seq    bigint not null default 0,
  updated_at  timestamptz not null default now()
);

alter table public.online_order_counters enable row level security;

create policy online_order_counters_member_select on public.online_order_counters
  for select using (
    tenant_id in (select app.current_user_tenant_ids()) or app.is_super_admin()
  );

create or replace function app.next_online_order_number(p_tenant_id uuid)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_seq bigint;
begin
  insert into public.online_order_counters (tenant_id, last_seq, updated_at)
  values (p_tenant_id, 1, now())
  on conflict (tenant_id)
  do update set last_seq = public.online_order_counters.last_seq + 1,
                updated_at = now()
  returning last_seq into v_seq;

  return 'WEB-' || to_char(v_seq, 'FM000000');
end;
$$;

revoke execute on function app.next_online_order_number(uuid) from public;

-- Online orders ----------------------------------------------------------------
create table public.online_orders (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  branch_id         uuid not null references public.branches(id) on delete restrict,
  sale_id           uuid references public.sales(id) on delete set null,
  order_number      text not null,
  status            public.online_order_status not null default 'pending',
  customer_name     text not null,
  customer_phone    text not null,
  customer_email    citext,
  delivery_address  text,
  notes             text,
  subtotal          numeric(14,4) not null default 0,
  vat_total         numeric(14,4) not null default 0,
  total             numeric(14,4) not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (tenant_id, order_number)
);

create index online_orders_tenant_idx on public.online_orders (tenant_id, created_at desc);
create index online_orders_status_idx on public.online_orders (tenant_id, status);

create trigger online_orders_set_updated_at
  before update on public.online_orders
  for each row execute function app.set_updated_at();

alter table public.online_orders enable row level security;

create policy online_orders_member_select on public.online_orders
  for select using (
    tenant_id in (select app.current_user_tenant_ids()) or app.is_super_admin()
  );

create policy online_orders_member_update on public.online_orders
  for update using (
    app.has_tenant_role(tenant_id, array['owner','manager','warehouse','delivery']::text[])
    or app.is_super_admin()
  );

-- Order line snapshots ---------------------------------------------------------
create table public.online_order_items (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  online_order_id uuid not null references public.online_orders(id) on delete cascade,
  product_id      uuid not null references public.products(id) on delete restrict,
  position        integer not null default 0,
  name_snapshot   text not null,
  sku_snapshot    text,
  quantity        numeric(14,4) not null check (quantity > 0),
  unit_price      numeric(14,4) not null,
  line_total_gross numeric(14,4) not null,
  created_at      timestamptz not null default now()
);

create index online_order_items_order_idx on public.online_order_items (online_order_id);

alter table public.online_order_items enable row level security;

create policy online_order_items_member_select on public.online_order_items
  for select using (
    tenant_id in (select app.current_user_tenant_ids()) or app.is_super_admin()
  );

-- Link payments to online orders (column existed, add FK now) ------------------
alter table public.payments
  add constraint payments_online_order_id_fkey
  foreign key (online_order_id) references public.online_orders(id) on delete set null;

-- Backfill storefront rows for existing tenants --------------------------------
insert into public.tenant_storefronts (tenant_id, branch_id, enabled, hero_title, hero_subtitle, order_notice)
select
  t.id,
  (
    select b.id
    from public.branches b
    where b.tenant_id = t.id and b.is_active = true and b.is_warehouse = false
    order by b.created_at
    limit 1
  ),
  true,
  'Fresh groceries delivered to your door',
  'Order online — same stock as our shop',
  'We will call you to confirm delivery and payment.'
from public.tenants t
where t.status in ('trial', 'active', 'past_due')
on conflict (tenant_id) do nothing;

-- Needscarlow demo copy --------------------------------------------------------
update public.tenant_storefronts ts
set
  tagline = 'Asian & international groceries in Carlow',
  phone = '+353 59 913 0000',
  whatsapp = '+353 87 000 0000',
  hero_title = 'Get fresh, natural groceries delivered to your home',
  hero_subtitle = 'Same range as our Carlow shop — stock updates live with in-store sales',
  order_notice = 'Pay on delivery. We will confirm your order by phone or WhatsApp.'
from public.tenants t
where ts.tenant_id = t.id and t.slug = 'needscarlow';

-- Extend onboarding to auto-create storefront ----------------------------------
create or replace function public.create_tenant_with_owner(
  p_legal_name           text,
  p_display_name         text,
  p_slug                 text,
  p_vat_number           text default null,
  p_country              text default 'IE',
  p_currency             text default 'EUR',
  p_timezone             text default 'Europe/Dublin',
  p_locale               text default 'en-IE',
  p_branch_code          text default 'MAIN',
  p_branch_name          text default null,
  p_branch_address_line1 text default null,
  p_branch_city          text default null,
  p_branch_county        text default null,
  p_branch_eircode       text default null
) returns table (tenant_id uuid, branch_id uuid, slug text)
language plpgsql security definer set search_path = '' as $$
declare
  v_user_id   uuid := auth.uid();
  v_tenant_id uuid;
  v_branch_id uuid;
  v_slug      text := lower(trim(coalesce(p_slug, '')));
  v_attempt   text;
  v_counter   int := 0;
  v_branch_name text;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if v_slug is null or length(v_slug) < 2 then
    raise exception 'slug must be at least 2 characters' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.user_tenants ut
    where ut.user_id = v_user_id
      and ut.is_active = true
  ) then
    raise exception 'caller already belongs to a tenant' using errcode = '42501';
  end if;

  v_attempt := v_slug;
  while exists (select 1 from public.tenants t where t.slug = v_attempt) loop
    v_counter := v_counter + 1;
    if v_counter > 100 then
      raise exception 'could not find a unique slug for %', v_slug;
    end if;
    v_attempt := v_slug || '-' || v_counter::text;
  end loop;

  insert into public.tenants (
    slug, legal_name, display_name, vat_number,
    country, currency, timezone, default_locale,
    status, trial_ends_at, created_by, updated_by
  ) values (
    v_attempt,
    trim(p_legal_name),
    trim(p_display_name),
    nullif(trim(coalesce(p_vat_number, '')), ''),
    coalesce(p_country, 'IE'),
    coalesce(p_currency, 'EUR'),
    coalesce(p_timezone, 'Europe/Dublin'),
    coalesce(p_locale, 'en-IE'),
    'trial',
    now() + interval '30 days',
    v_user_id, v_user_id
  )
  returning id into v_tenant_id;

  v_branch_name := coalesce(nullif(trim(coalesce(p_branch_name, '')), ''), trim(p_display_name));
  insert into public.branches (
    tenant_id, code, name,
    address_line1, city, county, eircode,
    country, timezone, is_active, created_by, updated_by
  ) values (
    v_tenant_id,
    upper(trim(coalesce(p_branch_code, 'MAIN'))),
    v_branch_name,
    nullif(trim(coalesce(p_branch_address_line1, '')), ''),
    nullif(trim(coalesce(p_branch_city, '')), ''),
    nullif(trim(coalesce(p_branch_county, '')), ''),
    nullif(trim(coalesce(p_branch_eircode, '')), ''),
    coalesce(p_country, 'IE'),
    coalesce(p_timezone, 'Europe/Dublin'),
    true,
    v_user_id, v_user_id
  )
  returning id into v_branch_id;

  insert into public.user_tenants (tenant_id, user_id, role, is_active)
  values (v_tenant_id, v_user_id, 'owner', true);

  insert into public.tenant_storefronts (tenant_id, branch_id, enabled, hero_title, hero_subtitle)
  values (
    v_tenant_id,
    v_branch_id,
    true,
    'Welcome to ' || trim(p_display_name),
    'Order online — stock stays in sync with our shop'
  );

  return query select v_tenant_id, v_branch_id, v_attempt;
end;
$$;

-- =============================================================================
-- commit_online_order: public checkout (called from trusted server via service role)
-- Deducts available stock immediately (same pool as POS).
-- =============================================================================
create or replace function public.commit_online_order(
  p_tenant_slug   text,
  p_items         jsonb,
  p_customer      jsonb,
  p_client_uuid   uuid default null
) returns table (
  online_order_id uuid,
  order_number    text,
  sale_id         uuid,
  total           numeric
)
language plpgsql security definer set search_path = '' as $$
declare
  v_tenant_id     uuid;
  v_branch_id     uuid;
  v_branch_code   text;
  v_store         record;
  v_order_id      uuid := gen_random_uuid();
  v_sale_id       uuid := gen_random_uuid();
  v_order_no      text;
  v_receipt_no    text;
  v_item          jsonb;
  v_position      integer := 0;
  v_product       record;
  v_qty           numeric(14,4);
  v_available     numeric(14,4);
  v_unit_price    numeric(14,4);
  v_unit_cost     numeric(14,4);
  v_vat_code      public.vat_code;
  v_vat_rate      numeric(6,4);
  v_vat_incl      boolean;
  v_line_gross    numeric(14,4);
  v_line_net      numeric(14,4);
  v_line_vat      numeric(14,4);
  v_subtotal      numeric(14,4) := 0;
  v_vat_total     numeric(14,4) := 0;
  v_total         numeric(14,4) := 0;
  v_breakdown     jsonb := '{}'::jsonb;
  v_existing      jsonb;
  v_idem          jsonb;
  v_cust_name     text;
  v_cust_phone    text;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'commit_online_order: items must be a non-empty array';
  end if;

  select t.id into v_tenant_id
    from public.tenants t
   where t.slug = lower(trim(p_tenant_slug))
     and t.status in ('trial', 'active', 'past_due');

  if v_tenant_id is null then
    raise exception 'commit_online_order: shop not found' using errcode = '23503';
  end if;

  select * into v_store
    from public.tenant_storefronts ts
   where ts.tenant_id = v_tenant_id and ts.enabled = true;

  if not found then
    raise exception 'commit_online_order: online store is not enabled for this shop' using errcode = '42501';
  end if;

  if p_client_uuid is not null then
    select response_body into v_idem
      from public.idempotency_keys
     where key = ('online:' || p_client_uuid::text)
       and tenant_id = v_tenant_id;
    if v_idem is not null then
      return query
        select
          (v_idem->>'online_order_id')::uuid,
          v_idem->>'order_number',
          (v_idem->>'sale_id')::uuid,
          (v_idem->>'total')::numeric;
      return;
    end if;
  end if;

  v_branch_id := v_store.branch_id;
  if v_branch_id is null then
    select b.id, b.code into v_branch_id, v_branch_code
      from public.branches b
     where b.tenant_id = v_tenant_id
       and b.is_active = true
       and b.is_warehouse = false
     order by b.created_at
     limit 1;
  else
    select code into v_branch_code from public.branches where id = v_branch_id;
  end if;

  if v_branch_id is null then
    raise exception 'commit_online_order: no active branch for fulfilment';
  end if;

  v_cust_name := trim(coalesce(p_customer->>'name', ''));
  v_cust_phone := trim(coalesce(p_customer->>'phone', ''));
  if length(v_cust_name) < 2 then
    raise exception 'commit_online_order: customer name is required';
  end if;
  if length(v_cust_phone) < 6 then
    raise exception 'commit_online_order: customer phone is required';
  end if;

  v_order_no := app.next_online_order_number(v_tenant_id);
  v_receipt_no := app.next_receipt_number(v_tenant_id, v_branch_id, coalesce(v_branch_code, 'WEB'));

  insert into public.online_orders (
    id, tenant_id, branch_id, order_number, status,
    customer_name, customer_phone, customer_email, delivery_address, notes
  ) values (
    v_order_id, v_tenant_id, v_branch_id, v_order_no, 'pending',
    v_cust_name, v_cust_phone,
    nullif(trim(coalesce(p_customer->>'email', '')), ''),
    nullif(trim(coalesce(p_customer->>'address', '')), ''),
    nullif(trim(coalesce(p_customer->>'notes', '')), '')
  );

  insert into public.sales (
    id, tenant_id, branch_id, channel, status, receipt_number, notes,
    subtotal, discount_total, vat_total, total, rounding, vat_breakdown
  ) values (
    v_sale_id, v_tenant_id, v_branch_id, 'online', 'completed', v_receipt_no,
    'Online order ' || v_order_no,
    0, 0, 0, 0, 0, '{}'::jsonb
  );

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_position := v_position + 1;
    v_qty := (v_item->>'qty')::numeric(14,4);

    if v_qty is null or v_qty <= 0 then
      raise exception 'commit_online_order: qty must be positive (item %)', v_position;
    end if;

    select id, name, sku, selling_price, purchase_price, vat_code, vat_included, is_active
      into v_product
      from public.products
     where id = (v_item->>'product_id')::uuid
       and tenant_id = v_tenant_id;

    if not found or not v_product.is_active then
      raise exception 'commit_online_order: product not available (item %)', v_position;
    end if;

    select coalesce(sb.quantity, 0) into v_available
      from public.stock_balances sb
     where sb.tenant_id = v_tenant_id
       and sb.branch_id = v_branch_id
       and sb.product_id = v_product.id
       and sb.variant_id is null
       and sb.state = 'available';

    v_available := coalesce(v_available, 0);
    if v_available < v_qty then
      raise exception 'commit_online_order: insufficient stock for % (have %, need %)',
        v_product.name, v_available, v_qty using errcode = '22023';
    end if;

    v_unit_price := v_product.selling_price;
    v_unit_cost  := v_product.purchase_price;
    v_vat_code   := v_product.vat_code;
    v_vat_incl   := v_product.vat_included;

    v_vat_rate := case v_vat_code
      when 'STD' then 0.23
      when 'RED' then 0.135
      when 'SEC' then 0.09
      when 'LIV' then 0.048
      when 'ZER' then 0.0
      when 'EXE' then 0.0
    end;

    if v_vat_incl then
      v_line_gross := round(v_unit_price * v_qty, 4);
      v_line_net := round(v_line_gross / (1 + v_vat_rate), 4);
      v_line_vat := round(v_line_gross - v_line_net, 4);
    else
      v_line_net := round(v_unit_price * v_qty, 4);
      v_line_vat := round(v_line_net * v_vat_rate, 4);
      v_line_gross := round(v_line_net + v_line_vat, 4);
    end if;

    insert into public.online_order_items (
      tenant_id, online_order_id, product_id, position,
      name_snapshot, sku_snapshot, quantity, unit_price, line_total_gross
    ) values (
      v_tenant_id, v_order_id, v_product.id, v_position,
      v_product.name, v_product.sku, v_qty, v_unit_price, v_line_gross
    );

    insert into public.sale_items (
      tenant_id, sale_id, product_id, position,
      name_snapshot, sku_snapshot, quantity, unit_price, unit_cost,
      vat_code, vat_rate, discount,
      line_total_gross, line_total_net, line_vat
    ) values (
      v_tenant_id, v_sale_id, v_product.id, v_position,
      v_product.name, v_product.sku, v_qty, v_unit_price, v_unit_cost,
      v_vat_code, v_vat_rate, 0,
      v_line_gross, v_line_net, v_line_vat
    );

    perform app.apply_stock_movement(
      v_tenant_id, v_branch_id, v_product.id, null, null,
      'pos_sale', 'available'::public.stock_state, null,
      v_qty, v_unit_cost,
      'online_order', v_order_id, null, 'Online order ' || v_order_no
    );

    v_subtotal := v_subtotal + v_line_net;
    v_vat_total := v_vat_total + v_line_vat;
    v_total := v_total + v_line_gross;

    v_existing := coalesce(v_breakdown->v_vat_code::text, jsonb_build_object('rate', v_vat_rate, 'base', 0, 'vat', 0));
    v_breakdown := jsonb_set(
      v_breakdown,
      array[v_vat_code::text],
      jsonb_build_object(
        'rate', v_vat_rate,
        'base', round(((v_existing->>'base')::numeric + v_line_net), 4),
        'vat',  round(((v_existing->>'vat')::numeric  + v_line_vat), 4)
      ),
      true
    );
  end loop;

  v_total := round(v_total, 2);

  update public.sales
     set subtotal = round(v_subtotal, 2),
         vat_total = round(v_vat_total, 2),
         total = v_total,
         vat_breakdown = v_breakdown
   where id = v_sale_id;

  update public.online_orders
     set sale_id = v_sale_id,
         subtotal = round(v_subtotal, 2),
         vat_total = round(v_vat_total, 2),
         total = v_total
   where id = v_order_id;

  insert into public.payments (
    tenant_id, sale_id, online_order_id, method, amount, status, captured_at
  ) values (
    v_tenant_id, v_sale_id, v_order_id, 'cash', v_total, 'pending', null
  );

  if p_client_uuid is not null then
    insert into public.idempotency_keys (key, tenant_id, user_id, response_body, status_code)
    values (
      'online:' || p_client_uuid::text,
      v_tenant_id,
      null,
      jsonb_build_object(
        'online_order_id', v_order_id,
        'order_number', v_order_no,
        'sale_id', v_sale_id,
        'total', v_total
      ),
      201
    )
    on conflict (key) do nothing;
  end if;

  return query select v_order_id, v_order_no, v_sale_id, v_total;
end;
$$;

comment on function public.commit_online_order is
  'Place an online order: validates stock, writes sale (channel=online), deducts available stock. Called from server with service role.';

revoke execute on function public.commit_online_order(text, jsonb, jsonb, uuid) from public;
grant execute on function public.commit_online_order(text, jsonb, jsonb, uuid) to service_role;

-- >>> 20260604160000_storefront_checkout_delivery.sql
-- =============================================================================
-- Storefront checkout: delivery fees, fulfillment (delivery/takeaway), payment choice
-- =============================================================================

do $enum$ begin
  create type public.online_fulfillment_type as enum ('delivery', 'takeaway');
exception when duplicate_object then null;
end $enum$;

do $enum$ begin
  create type public.online_checkout_payment as enum ('cod', 'online_card');
exception when duplicate_object then null;
end $enum$;

alter table public.tenant_storefronts
  add column if not exists public_site_name text,
  add column if not exists custom_domain text,
  add column if not exists delivery_standard_fee numeric(14,4) not null default 4.99,
  add column if not exists delivery_free_over numeric(14,4) not null default 50,
  add column if not exists delivery_min_order numeric(14,4) not null default 15,
  add column if not exists enable_takeaway boolean not null default true,
  add column if not exists enable_online_payment boolean not null default true;

comment on column public.tenant_storefronts.public_site_name is
  'Name shown on the public shop (defaults to tenant display_name).';
comment on column public.tenant_storefronts.custom_domain is
  'Future custom domain e.g. shop.example.ie. Until DNS is wired, use /shop/{slug}.';
comment on column public.tenant_storefronts.delivery_standard_fee is
  'Flat delivery fee (EUR) when order subtotal is below delivery_free_over.';
comment on column public.tenant_storefronts.delivery_free_over is
  'Free delivery when product subtotal (gross) is at or above this amount.';

alter table public.online_orders
  add column if not exists fulfillment_type public.online_fulfillment_type not null default 'delivery',
  add column if not exists payment_method public.online_checkout_payment not null default 'cod',
  add column if not exists delivery_fee numeric(14,4) not null default 0,
  add column if not exists products_total numeric(14,4) not null default 0,
  add column if not exists pickup_at timestamptz;

-- Backfill products_total from existing total where delivery_fee was 0
update public.online_orders
   set products_total = total
 where products_total = 0 and delivery_fee = 0;

update public.tenant_storefronts ts
set
  public_site_name = coalesce(ts.public_site_name, t.display_name),
  custom_domain = 'needscarlow.ie'
from public.tenants t
where ts.tenant_id = t.id and t.slug = 'needscarlow';

-- Return type adds delivery_fee + products_total — must drop before recreate
drop function if exists public.commit_online_order(text, jsonb, jsonb, uuid);

create function public.commit_online_order(
  p_tenant_slug   text,
  p_items         jsonb,
  p_customer      jsonb,
  p_client_uuid   uuid default null
) returns table (
  online_order_id uuid,
  order_number    text,
  sale_id         uuid,
  total           numeric,
  delivery_fee    numeric,
  products_total  numeric
)
language plpgsql security definer set search_path = '' as $$
declare
  v_tenant_id       uuid;
  v_branch_id       uuid;
  v_branch_code     text;
  v_store           record;
  v_order_id        uuid := gen_random_uuid();
  v_sale_id         uuid := gen_random_uuid();
  v_order_no        text;
  v_receipt_no      text;
  v_item            jsonb;
  v_position        integer := 0;
  v_product         record;
  v_qty             numeric(14,4);
  v_available       numeric(14,4);
  v_unit_price      numeric(14,4);
  v_unit_cost       numeric(14,4);
  v_vat_code        public.vat_code;
  v_vat_rate        numeric(6,4);
  v_vat_incl        boolean;
  v_line_gross      numeric(14,4);
  v_line_net        numeric(14,4);
  v_line_vat        numeric(14,4);
  v_subtotal        numeric(14,4) := 0;
  v_vat_total       numeric(14,4) := 0;
  v_products_gross  numeric(14,4) := 0;
  v_delivery_fee    numeric(14,4) := 0;
  v_delivery_net    numeric(14,4) := 0;
  v_delivery_vat    numeric(14,4) := 0;
  v_total           numeric(14,4) := 0;
  v_breakdown       jsonb := '{}'::jsonb;
  v_existing        jsonb;
  v_idem            jsonb;
  v_cust_name       text;
  v_cust_phone      text;
  v_fulfillment     public.online_fulfillment_type;
  v_payment         public.online_checkout_payment;
  v_pickup_at       timestamptz;
  v_pay_method      public.payment_method;
  v_pay_status      public.payment_status;
  v_sale_notes      text;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'commit_online_order: items must be a non-empty array';
  end if;

  select t.id into v_tenant_id
    from public.tenants t
   where t.slug = lower(trim(p_tenant_slug))
     and t.status in ('trial', 'active', 'past_due');

  if v_tenant_id is null then
    raise exception 'commit_online_order: shop not found' using errcode = '23503';
  end if;

  select * into v_store
    from public.tenant_storefronts ts
   where ts.tenant_id = v_tenant_id and ts.enabled = true;

  if not found then
    raise exception 'commit_online_order: online store is not enabled for this shop' using errcode = '42501';
  end if;

  if p_client_uuid is not null then
    select response_body into v_idem
      from public.idempotency_keys
     where key = ('online:' || p_client_uuid::text)
       and tenant_id = v_tenant_id;
    if v_idem is not null then
      return query
        select
          (v_idem->>'online_order_id')::uuid,
          v_idem->>'order_number',
          (v_idem->>'sale_id')::uuid,
          (v_idem->>'total')::numeric,
          coalesce((v_idem->>'delivery_fee')::numeric, 0),
          coalesce((v_idem->>'products_total')::numeric, 0);
      return;
    end if;
  end if;

  v_fulfillment := coalesce(
    nullif(trim(p_customer->>'fulfillment'), '')::public.online_fulfillment_type,
    'delivery'::public.online_fulfillment_type
  );
  v_payment := coalesce(
    nullif(trim(p_customer->>'payment_method'), '')::public.online_checkout_payment,
    'cod'::public.online_checkout_payment
  );

  if v_fulfillment = 'takeaway' and not coalesce(v_store.enable_takeaway, true) then
    raise exception 'commit_online_order: takeaway is not enabled for this shop' using errcode = '22023';
  end if;
  if v_payment = 'online_card' and not coalesce(v_store.enable_online_payment, true) then
    raise exception 'commit_online_order: online card payment is not enabled' using errcode = '22023';
  end if;

  v_branch_id := v_store.branch_id;
  if v_branch_id is null then
    select b.id, b.code into v_branch_id, v_branch_code
      from public.branches b
     where b.tenant_id = v_tenant_id
       and b.is_active = true
       and b.is_warehouse = false
     order by b.created_at
     limit 1;
  else
    select code into v_branch_code from public.branches where id = v_branch_id;
  end if;

  if v_branch_id is null then
    raise exception 'commit_online_order: no active branch for fulfilment';
  end if;

  v_cust_name := trim(coalesce(p_customer->>'name', ''));
  v_cust_phone := trim(coalesce(p_customer->>'phone', ''));
  if length(v_cust_name) < 2 then
    raise exception 'commit_online_order: customer name is required';
  end if;
  if length(v_cust_phone) < 6 then
    raise exception 'commit_online_order: customer phone is required';
  end if;

  if v_fulfillment = 'delivery' then
    if coalesce(trim(p_customer->>'address'), '') = '' then
      raise exception 'commit_online_order: delivery address is required';
    end if;
  else
    if coalesce(trim(p_customer->>'pickup_at'), '') = '' then
      raise exception 'commit_online_order: pickup date and time is required for takeaway';
    end if;
    begin
      v_pickup_at := (p_customer->>'pickup_at')::timestamptz;
    exception when others then
      raise exception 'commit_online_order: invalid pickup_at';
    end;
    if v_pickup_at < now() - interval '5 minutes' then
      raise exception 'commit_online_order: pickup time must be in the future';
    end if;
  end if;

  v_order_no := app.next_online_order_number(v_tenant_id);
  v_receipt_no := app.next_receipt_number(v_tenant_id, v_branch_id, coalesce(v_branch_code, 'WEB'));

  insert into public.online_orders (
    id, tenant_id, branch_id, order_number, status,
    customer_name, customer_phone, customer_email, delivery_address, notes,
    fulfillment_type, payment_method, pickup_at
  ) values (
    v_order_id, v_tenant_id, v_branch_id, v_order_no, 'pending',
    v_cust_name, v_cust_phone,
    nullif(trim(coalesce(p_customer->>'email', '')), ''),
    case when v_fulfillment = 'delivery'
      then nullif(trim(coalesce(p_customer->>'address', '')), '')
      else 'Collection in store' end,
    nullif(trim(coalesce(p_customer->>'notes', '')), ''),
    v_fulfillment, v_payment, v_pickup_at
  );

  insert into public.sales (
    id, tenant_id, branch_id, channel, status, receipt_number, notes,
    subtotal, discount_total, vat_total, total, rounding, vat_breakdown
  ) values (
    v_sale_id, v_tenant_id, v_branch_id, 'online', 'completed', v_receipt_no,
    'Online order ' || v_order_no,
    0, 0, 0, 0, 0, '{}'::jsonb
  );

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_position := v_position + 1;
    v_qty := (v_item->>'qty')::numeric(14,4);

    if v_qty is null or v_qty <= 0 then
      raise exception 'commit_online_order: qty must be positive (item %)', v_position;
    end if;

    select id, name, sku, selling_price, purchase_price, online_selling_price, online_discount_pct,
           vat_code, vat_included, is_active
      into v_product
      from public.products
     where id = (v_item->>'product_id')::uuid
       and tenant_id = v_tenant_id;

    if not found or not v_product.is_active then
      raise exception 'commit_online_order: product not available (item %)', v_position;
    end if;

    select coalesce(sb.quantity, 0) into v_available
      from public.stock_balances sb
     where sb.tenant_id = v_tenant_id
       and sb.branch_id = v_branch_id
       and sb.product_id = v_product.id
       and sb.variant_id is null
       and sb.state = 'available';

    v_available := coalesce(v_available, 0);
    if v_available < v_qty then
      raise exception 'commit_online_order: insufficient stock for % (have %, need %)',
        v_product.name, v_available, v_qty using errcode = '22023';
    end if;

    v_unit_price := app.online_product_unit_price(
      v_product.selling_price,
      v_product.online_selling_price,
      v_product.online_discount_pct,
      coalesce(v_store.online_price_markup_pct, 0.5)
    );
    v_unit_cost  := v_product.purchase_price;
    v_vat_code   := v_product.vat_code;
    v_vat_incl   := v_product.vat_included;

    v_vat_rate := case v_vat_code
      when 'STD' then 0.23
      when 'RED' then 0.135
      when 'SEC' then 0.09
      when 'LIV' then 0.048
      when 'ZER' then 0.0
      when 'EXE' then 0.0
    end;

    if v_vat_incl then
      v_line_gross := round(v_unit_price * v_qty, 4);
      v_line_net := round(v_line_gross / (1 + v_vat_rate), 4);
      v_line_vat := round(v_line_gross - v_line_net, 4);
    else
      v_line_net := round(v_unit_price * v_qty, 4);
      v_line_vat := round(v_line_net * v_vat_rate, 4);
      v_line_gross := round(v_line_net + v_line_vat, 4);
    end if;

    insert into public.online_order_items (
      tenant_id, online_order_id, product_id, position,
      name_snapshot, sku_snapshot, quantity, unit_price, line_total_gross
    ) values (
      v_tenant_id, v_order_id, v_product.id, v_position,
      v_product.name, v_product.sku, v_qty, v_unit_price, v_line_gross
    );

    insert into public.sale_items (
      tenant_id, sale_id, product_id, position,
      name_snapshot, sku_snapshot, quantity, unit_price, unit_cost,
      vat_code, vat_rate, discount,
      line_total_gross, line_total_net, line_vat
    ) values (
      v_tenant_id, v_sale_id, v_product.id, v_position,
      v_product.name, v_product.sku, v_qty, v_unit_price, v_unit_cost,
      v_vat_code, v_vat_rate, 0,
      v_line_gross, v_line_net, v_line_vat
    );

    perform app.apply_stock_movement(
      v_tenant_id, v_branch_id, v_product.id, null, null,
      'pos_sale', 'available'::public.stock_state, null,
      v_qty, v_unit_cost,
      'online_order', v_order_id, null, 'Online order ' || v_order_no
    );

    v_subtotal := v_subtotal + v_line_net;
    v_vat_total := v_vat_total + v_line_vat;
    v_products_gross := v_products_gross + v_line_gross;

    v_existing := coalesce(v_breakdown->v_vat_code::text, jsonb_build_object('rate', v_vat_rate, 'base', 0, 'vat', 0));
    v_breakdown := jsonb_set(
      v_breakdown,
      array[v_vat_code::text],
      jsonb_build_object(
        'rate', v_vat_rate,
        'base', round(((v_existing->>'base')::numeric + v_line_net), 4),
        'vat',  round(((v_existing->>'vat')::numeric  + v_line_vat), 4)
      ),
      true
    );
  end loop;

  v_products_gross := round(v_products_gross, 2);

  if v_fulfillment = 'delivery' then
    if v_products_gross < coalesce(v_store.delivery_free_over, 50) then
      v_delivery_fee := round(coalesce(v_store.delivery_standard_fee, 4.99), 2);
    end if;
  end if;

  if v_delivery_fee > 0 then
    v_delivery_net := round(v_delivery_fee / 1.23, 4);
    v_delivery_vat := round(v_delivery_fee - v_delivery_net, 4);
    v_subtotal := v_subtotal + v_delivery_net;
    v_vat_total := v_vat_total + v_delivery_vat;
    v_existing := coalesce(v_breakdown->'STD', jsonb_build_object('rate', 0.23, 'base', 0, 'vat', 0));
    v_breakdown := jsonb_set(
      v_breakdown,
      array['STD'],
      jsonb_build_object(
        'rate', 0.23,
        'base', round(((v_existing->>'base')::numeric + v_delivery_net), 4),
        'vat',  round(((v_existing->>'vat')::numeric  + v_delivery_vat), 4)
      ),
      true
    );
  end if;

  v_total := round(v_products_gross + v_delivery_fee, 2);

  v_sale_notes := 'Online order ' || v_order_no
    || ' | ' || initcap(replace(v_fulfillment::text, '_', ' '))
    || ' | ' || initcap(replace(v_payment::text, '_', ' '));
  if v_delivery_fee > 0 then
    v_sale_notes := v_sale_notes || ' | Delivery €' || v_delivery_fee::text;
  end if;
  if v_pickup_at is not null then
    v_sale_notes := v_sale_notes || ' | Pickup ' || to_char(v_pickup_at at time zone 'Europe/Dublin', 'YYYY-MM-DD HH24:MI');
  end if;

  update public.sales
     set subtotal = round(v_subtotal, 2),
         vat_total = round(v_vat_total, 2),
         total = v_total,
         vat_breakdown = v_breakdown,
         notes = v_sale_notes
   where id = v_sale_id;

  update public.online_orders
     set sale_id = v_sale_id,
         subtotal = round(v_subtotal, 2),
         vat_total = round(v_vat_total, 2),
         products_total = v_products_gross,
         delivery_fee = v_delivery_fee,
         total = v_total
   where id = v_order_id;

  if v_payment = 'online_card' then
    v_pay_method := 'card';
    v_pay_status := 'pending';
  else
    v_pay_method := 'cash';
    v_pay_status := 'pending';
  end if;

  insert into public.payments (
    tenant_id, sale_id, online_order_id, method, amount, status, captured_at
  ) values (
    v_tenant_id, v_sale_id, v_order_id, v_pay_method, v_total, v_pay_status, null
  );

  if p_client_uuid is not null then
    insert into public.idempotency_keys (key, tenant_id, user_id, response_body, status_code)
    values (
      'online:' || p_client_uuid::text,
      v_tenant_id,
      null,
      jsonb_build_object(
        'online_order_id', v_order_id,
        'order_number', v_order_no,
        'sale_id', v_sale_id,
        'total', v_total,
        'delivery_fee', v_delivery_fee,
        'products_total', v_products_gross
      ),
      201
    )
    on conflict (key) do nothing;
  end if;

  return query select v_order_id, v_order_no, v_sale_id, v_total, v_delivery_fee, v_products_gross;
end;
$$;

revoke execute on function public.commit_online_order(text, jsonb, jsonb, uuid) from public;
grant execute on function public.commit_online_order(text, jsonb, jsonb, uuid) to service_role;

-- >>> 20260604170000_storefront_logo.sql
-- Storefront website logo (top-left on public shop)

alter table public.tenant_storefronts
  add column if not exists logo_url text;

comment on column public.tenant_storefronts.logo_url is
  'Public URL for shop header logo (Supabase storage or site path).';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'storefront-logos',
  'storefront-logos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy storefront_logos_public_read on storage.objects
  for select
  using (bucket_id = 'storefront-logos');

create policy storefront_logos_authenticated_insert on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'storefront-logos');

create policy storefront_logos_authenticated_update on storage.objects
  for update
  to authenticated
  using (bucket_id = 'storefront-logos');

create policy storefront_logos_authenticated_delete on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'storefront-logos');

-- Default Needs Carlow logo (bundled under /public/shops/needscarlow/logo.png)
update public.tenant_storefronts ts
set logo_url = '/shops/needscarlow/logo.png'
from public.tenants t
where ts.tenant_id = t.id
  and t.slug = 'needscarlow'
  and (ts.logo_url is null or ts.logo_url = '');

-- >>> 20260604180000_storefront_search_footer_online_pricing.sql
-- Footer content, social links, global online markup, per-product online price & discount

alter table public.tenant_storefronts
  add column if not exists footer_about text,
  add column if not exists call_us_label text default 'Call us now',
  add column if not exists facebook_url text,
  add column if not exists twitter_url text,
  add column if not exists youtube_url text,
  add column if not exists instagram_url text,
  add column if not exists online_price_markup_pct numeric(8,4) not null default 0.5;

comment on column public.tenant_storefronts.footer_about is
  'About column text on public shop footer.';
comment on column public.tenant_storefronts.online_price_markup_pct is
  'Default % added to in-store selling price for online shop when product has no manual online price.';

alter table public.products
  add column if not exists online_selling_price numeric(14,4),
  add column if not exists online_discount_pct numeric(6,2);

comment on column public.products.online_selling_price is
  'Manual online shop price (gross). Null = auto from selling_price + storefront markup %.';
comment on column public.products.online_discount_pct is
  'Online-only discount % off the online base price (0–100). Does not affect POS.';

-- Compute online unit price (gross, VAT-inclusive when product.vat_included)
create or replace function app.online_product_unit_price(
  p_selling_price numeric,
  p_online_selling_price numeric,
  p_online_discount_pct numeric,
  p_markup_pct numeric
) returns numeric
language sql immutable parallel safe as $$
  select round(
    coalesce(
      p_online_selling_price,
      round(p_selling_price * (1 + coalesce(p_markup_pct, 0.5) / 100), 4)
    ) * (1 - greatest(0, least(coalesce(p_online_discount_pct, 0), 100)) / 100),
    2
  );
$$;

create or replace function app.online_product_base_price(
  p_selling_price numeric,
  p_online_selling_price numeric,
  p_markup_pct numeric
) returns numeric
language sql immutable parallel safe as $$
  select round(
    coalesce(
      p_online_selling_price,
      round(p_selling_price * (1 + coalesce(p_markup_pct, 0.5) / 100), 4)
    ),
    2
  );
$$;

update public.tenant_storefronts ts
set
  footer_about = coalesce(
    ts.footer_about,
    'Needscarlow is more than just a grocery store — it is your gateway to the tastes of Asia, right in the heart of Carlow Town. We provide a diverse selection of essential products for your kitchen.'
  ),
  call_us_label = coalesce(ts.call_us_label, 'Call us now'),
  online_price_markup_pct = coalesce(ts.online_price_markup_pct, 0.5)
from public.tenants t
where ts.tenant_id = t.id and t.slug = 'needscarlow';

-- >>> 20260604180100_online_order_online_price.sql
-- Use online shop prices in commit_online_order (for DBs that applied checkout migration before product columns)

-- Return type adds delivery_fee + products_total — must drop before recreate
drop function if exists public.commit_online_order(text, jsonb, jsonb, uuid);

create function public.commit_online_order(
  p_tenant_slug   text,
  p_items         jsonb,
  p_customer      jsonb,
  p_client_uuid   uuid default null
) returns table (
  online_order_id uuid,
  order_number    text,
  sale_id         uuid,
  total           numeric,
  delivery_fee    numeric,
  products_total  numeric
)
language plpgsql security definer set search_path = '' as $$
declare
  v_tenant_id       uuid;
  v_branch_id       uuid;
  v_branch_code     text;
  v_store           record;
  v_order_id        uuid := gen_random_uuid();
  v_sale_id         uuid := gen_random_uuid();
  v_order_no        text;
  v_receipt_no      text;
  v_item            jsonb;
  v_position        integer := 0;
  v_product         record;
  v_qty             numeric(14,4);
  v_available       numeric(14,4);
  v_unit_price      numeric(14,4);
  v_unit_cost       numeric(14,4);
  v_vat_code        public.vat_code;
  v_vat_rate        numeric(6,4);
  v_vat_incl        boolean;
  v_line_gross      numeric(14,4);
  v_line_net        numeric(14,4);
  v_line_vat        numeric(14,4);
  v_subtotal        numeric(14,4) := 0;
  v_vat_total       numeric(14,4) := 0;
  v_products_gross  numeric(14,4) := 0;
  v_delivery_fee    numeric(14,4) := 0;
  v_delivery_net    numeric(14,4) := 0;
  v_delivery_vat    numeric(14,4) := 0;
  v_total           numeric(14,4) := 0;
  v_breakdown       jsonb := '{}'::jsonb;
  v_existing        jsonb;
  v_idem            jsonb;
  v_cust_name       text;
  v_cust_phone      text;
  v_fulfillment     public.online_fulfillment_type;
  v_payment         public.online_checkout_payment;
  v_pickup_at       timestamptz;
  v_pay_method      public.payment_method;
  v_pay_status      public.payment_status;
  v_sale_notes      text;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'commit_online_order: items must be a non-empty array';
  end if;

  select t.id into v_tenant_id
    from public.tenants t
   where t.slug = lower(trim(p_tenant_slug))
     and t.status in ('trial', 'active', 'past_due');

  if v_tenant_id is null then
    raise exception 'commit_online_order: shop not found' using errcode = '23503';
  end if;

  select * into v_store
    from public.tenant_storefronts ts
   where ts.tenant_id = v_tenant_id and ts.enabled = true;

  if not found then
    raise exception 'commit_online_order: online store is not enabled for this shop' using errcode = '42501';
  end if;

  if p_client_uuid is not null then
    select response_body into v_idem
      from public.idempotency_keys
     where key = ('online:' || p_client_uuid::text)
       and tenant_id = v_tenant_id;
    if v_idem is not null then
      return query
        select
          (v_idem->>'online_order_id')::uuid,
          v_idem->>'order_number',
          (v_idem->>'sale_id')::uuid,
          (v_idem->>'total')::numeric,
          coalesce((v_idem->>'delivery_fee')::numeric, 0),
          coalesce((v_idem->>'products_total')::numeric, 0);
      return;
    end if;
  end if;

  v_fulfillment := coalesce(
    nullif(trim(p_customer->>'fulfillment'), '')::public.online_fulfillment_type,
    'delivery'::public.online_fulfillment_type
  );
  v_payment := coalesce(
    nullif(trim(p_customer->>'payment_method'), '')::public.online_checkout_payment,
    'cod'::public.online_checkout_payment
  );

  if v_fulfillment = 'takeaway' and not coalesce(v_store.enable_takeaway, true) then
    raise exception 'commit_online_order: takeaway is not enabled for this shop' using errcode = '22023';
  end if;
  if v_payment = 'online_card' and not coalesce(v_store.enable_online_payment, true) then
    raise exception 'commit_online_order: online card payment is not enabled' using errcode = '22023';
  end if;

  v_branch_id := v_store.branch_id;
  if v_branch_id is null then
    select b.id, b.code into v_branch_id, v_branch_code
      from public.branches b
     where b.tenant_id = v_tenant_id
       and b.is_active = true
       and b.is_warehouse = false
     order by b.created_at
     limit 1;
  else
    select code into v_branch_code from public.branches where id = v_branch_id;
  end if;

  if v_branch_id is null then
    raise exception 'commit_online_order: no active branch for fulfilment';
  end if;

  v_cust_name := trim(coalesce(p_customer->>'name', ''));
  v_cust_phone := trim(coalesce(p_customer->>'phone', ''));
  if length(v_cust_name) < 2 then
    raise exception 'commit_online_order: customer name is required';
  end if;
  if length(v_cust_phone) < 6 then
    raise exception 'commit_online_order: customer phone is required';
  end if;

  if v_fulfillment = 'delivery' then
    if coalesce(trim(p_customer->>'address'), '') = '' then
      raise exception 'commit_online_order: delivery address is required';
    end if;
  else
    if coalesce(trim(p_customer->>'pickup_at'), '') = '' then
      raise exception 'commit_online_order: pickup date and time is required for takeaway';
    end if;
    begin
      v_pickup_at := (p_customer->>'pickup_at')::timestamptz;
    exception when others then
      raise exception 'commit_online_order: invalid pickup_at';
    end;
    if v_pickup_at < now() - interval '5 minutes' then
      raise exception 'commit_online_order: pickup time must be in the future';
    end if;
  end if;

  v_order_no := app.next_online_order_number(v_tenant_id);
  v_receipt_no := app.next_receipt_number(v_tenant_id, v_branch_id, coalesce(v_branch_code, 'WEB'));

  insert into public.online_orders (
    id, tenant_id, branch_id, order_number, status,
    customer_name, customer_phone, customer_email, delivery_address, notes,
    fulfillment_type, payment_method, pickup_at
  ) values (
    v_order_id, v_tenant_id, v_branch_id, v_order_no, 'pending',
    v_cust_name, v_cust_phone,
    nullif(trim(coalesce(p_customer->>'email', '')), ''),
    case when v_fulfillment = 'delivery'
      then nullif(trim(coalesce(p_customer->>'address', '')), '')
      else 'Collection in store' end,
    nullif(trim(coalesce(p_customer->>'notes', '')), ''),
    v_fulfillment, v_payment, v_pickup_at
  );

  insert into public.sales (
    id, tenant_id, branch_id, channel, status, receipt_number, notes,
    subtotal, discount_total, vat_total, total, rounding, vat_breakdown
  ) values (
    v_sale_id, v_tenant_id, v_branch_id, 'online', 'completed', v_receipt_no,
    'Online order ' || v_order_no,
    0, 0, 0, 0, 0, '{}'::jsonb
  );

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_position := v_position + 1;
    v_qty := (v_item->>'qty')::numeric(14,4);

    if v_qty is null or v_qty <= 0 then
      raise exception 'commit_online_order: qty must be positive (item %)', v_position;
    end if;

    select id, name, sku, selling_price, purchase_price, online_selling_price, online_discount_pct,
           vat_code, vat_included, is_active
      into v_product
      from public.products
     where id = (v_item->>'product_id')::uuid
       and tenant_id = v_tenant_id;

    if not found or not v_product.is_active then
      raise exception 'commit_online_order: product not available (item %)', v_position;
    end if;

    select coalesce(sb.quantity, 0) into v_available
      from public.stock_balances sb
     where sb.tenant_id = v_tenant_id
       and sb.branch_id = v_branch_id
       and sb.product_id = v_product.id
       and sb.variant_id is null
       and sb.state = 'available';

    v_available := coalesce(v_available, 0);
    if v_available < v_qty then
      raise exception 'commit_online_order: insufficient stock for % (have %, need %)',
        v_product.name, v_available, v_qty using errcode = '22023';
    end if;

    v_unit_price := app.online_product_unit_price(
      v_product.selling_price,
      v_product.online_selling_price,
      v_product.online_discount_pct,
      coalesce(v_store.online_price_markup_pct, 0.5)
    );
    v_unit_cost  := v_product.purchase_price;
    v_vat_code   := v_product.vat_code;
    v_vat_incl   := v_product.vat_included;

    v_vat_rate := case v_vat_code
      when 'STD' then 0.23
      when 'RED' then 0.135
      when 'SEC' then 0.09
      when 'LIV' then 0.048
      when 'ZER' then 0.0
      when 'EXE' then 0.0
    end;

    if v_vat_incl then
      v_line_gross := round(v_unit_price * v_qty, 4);
      v_line_net := round(v_line_gross / (1 + v_vat_rate), 4);
      v_line_vat := round(v_line_gross - v_line_net, 4);
    else
      v_line_net := round(v_unit_price * v_qty, 4);
      v_line_vat := round(v_line_net * v_vat_rate, 4);
      v_line_gross := round(v_line_net + v_line_vat, 4);
    end if;

    insert into public.online_order_items (
      tenant_id, online_order_id, product_id, position,
      name_snapshot, sku_snapshot, quantity, unit_price, line_total_gross
    ) values (
      v_tenant_id, v_order_id, v_product.id, v_position,
      v_product.name, v_product.sku, v_qty, v_unit_price, v_line_gross
    );

    insert into public.sale_items (
      tenant_id, sale_id, product_id, position,
      name_snapshot, sku_snapshot, quantity, unit_price, unit_cost,
      vat_code, vat_rate, discount,
      line_total_gross, line_total_net, line_vat
    ) values (
      v_tenant_id, v_sale_id, v_product.id, v_position,
      v_product.name, v_product.sku, v_qty, v_unit_price, v_unit_cost,
      v_vat_code, v_vat_rate, 0,
      v_line_gross, v_line_net, v_line_vat
    );

    perform app.apply_stock_movement(
      v_tenant_id, v_branch_id, v_product.id, null, null,
      'pos_sale', 'available'::public.stock_state, null,
      v_qty, v_unit_cost,
      'online_order', v_order_id, null, 'Online order ' || v_order_no
    );

    v_subtotal := v_subtotal + v_line_net;
    v_vat_total := v_vat_total + v_line_vat;
    v_products_gross := v_products_gross + v_line_gross;

    v_existing := coalesce(v_breakdown->v_vat_code::text, jsonb_build_object('rate', v_vat_rate, 'base', 0, 'vat', 0));
    v_breakdown := jsonb_set(
      v_breakdown,
      array[v_vat_code::text],
      jsonb_build_object(
        'rate', v_vat_rate,
        'base', round(((v_existing->>'base')::numeric + v_line_net), 4),
        'vat',  round(((v_existing->>'vat')::numeric  + v_line_vat), 4)
      ),
      true
    );
  end loop;

  v_products_gross := round(v_products_gross, 2);

  if v_fulfillment = 'delivery' then
    if v_products_gross < coalesce(v_store.delivery_free_over, 50) then
      v_delivery_fee := round(coalesce(v_store.delivery_standard_fee, 4.99), 2);
    end if;
  end if;

  if v_delivery_fee > 0 then
    v_delivery_net := round(v_delivery_fee / 1.23, 4);
    v_delivery_vat := round(v_delivery_fee - v_delivery_net, 4);
    v_subtotal := v_subtotal + v_delivery_net;
    v_vat_total := v_vat_total + v_delivery_vat;
    v_existing := coalesce(v_breakdown->'STD', jsonb_build_object('rate', 0.23, 'base', 0, 'vat', 0));
    v_breakdown := jsonb_set(
      v_breakdown,
      array['STD'],
      jsonb_build_object(
        'rate', 0.23,
        'base', round(((v_existing->>'base')::numeric + v_delivery_net), 4),
        'vat',  round(((v_existing->>'vat')::numeric  + v_delivery_vat), 4)
      ),
      true
    );
  end if;

  v_total := round(v_products_gross + v_delivery_fee, 2);

  v_sale_notes := 'Online order ' || v_order_no
    || ' | ' || initcap(replace(v_fulfillment::text, '_', ' '))
    || ' | ' || initcap(replace(v_payment::text, '_', ' '));
  if v_delivery_fee > 0 then
    v_sale_notes := v_sale_notes || ' | Delivery €' || v_delivery_fee::text;
  end if;
  if v_pickup_at is not null then
    v_sale_notes := v_sale_notes || ' | Pickup ' || to_char(v_pickup_at at time zone 'Europe/Dublin', 'YYYY-MM-DD HH24:MI');
  end if;

  update public.sales
     set subtotal = round(v_subtotal, 2),
         vat_total = round(v_vat_total, 2),
         total = v_total,
         vat_breakdown = v_breakdown,
         notes = v_sale_notes
   where id = v_sale_id;

  update public.online_orders
     set sale_id = v_sale_id,
         subtotal = round(v_subtotal, 2),
         vat_total = round(v_vat_total, 2),
         products_total = v_products_gross,
         delivery_fee = v_delivery_fee,
         total = v_total
   where id = v_order_id;

  if v_payment = 'online_card' then
    v_pay_method := 'card';
    v_pay_status := 'pending';
  else
    v_pay_method := 'cash';
    v_pay_status := 'pending';
  end if;

  insert into public.payments (
    tenant_id, sale_id, online_order_id, method, amount, status, captured_at
  ) values (
    v_tenant_id, v_sale_id, v_order_id, v_pay_method, v_total, v_pay_status, null
  );

  if p_client_uuid is not null then
    insert into public.idempotency_keys (key, tenant_id, user_id, response_body, status_code)
    values (
      'online:' || p_client_uuid::text,
      v_tenant_id,
      null,
      jsonb_build_object(
        'online_order_id', v_order_id,
        'order_number', v_order_no,
        'sale_id', v_sale_id,
        'total', v_total,
        'delivery_fee', v_delivery_fee,
        'products_total', v_products_gross
      ),
      201
    )
    on conflict (key) do nothing;
  end if;

  return query select v_order_id, v_order_no, v_sale_id, v_total, v_delivery_fee, v_products_gross;
end;
$$;

revoke execute on function public.commit_online_order(text, jsonb, jsonb, uuid) from public;
grant execute on function public.commit_online_order(text, jsonb, jsonb, uuid) to service_role;

-- >>> 20260604220000_fix_online_price_zero_manual.sql
-- Treat online_selling_price = 0 as "use auto markup" (empty form was saved as zero)

update public.products
set online_selling_price = null
where online_selling_price is not null and online_selling_price <= 0;

create or replace function app.online_product_unit_price(
  p_selling_price numeric,
  p_online_selling_price numeric,
  p_online_discount_pct numeric,
  p_markup_pct numeric
) returns numeric
language sql immutable parallel safe as $$
  select round(
    coalesce(
      nullif(p_online_selling_price, 0),
      round(p_selling_price * (1 + coalesce(p_markup_pct, 0.5) / 100), 4)
    ) * (1 - greatest(0, least(coalesce(p_online_discount_pct, 0), 100)) / 100),
    2
  );
$$;

create or replace function app.online_product_base_price(
  p_selling_price numeric,
  p_online_selling_price numeric,
  p_markup_pct numeric
) returns numeric
language sql immutable parallel safe as $$
  select round(
    coalesce(
      nullif(p_online_selling_price, 0),
      round(p_selling_price * (1 + coalesce(p_markup_pct, 0.5) / 100), 4)
    ),
    2
  );
$$;

-- >>> 20260604230000_saas_billing_platform.sql
-- SaaS billing (demo provider now, Stripe-ready columns), team invites, platform helpers

-- ---------------------------------------------------------------------------
-- Billing per tenant (demo card + future Stripe IDs)
-- ---------------------------------------------------------------------------
create table if not exists public.tenant_billing (
  tenant_id uuid primary key references public.tenants (id) on delete cascade,
  provider text not null default 'demo' check (provider in ('demo', 'stripe')),
  plan_code text not null default 'standard',
  monthly_amount_cents integer not null default 2000,
  currency text not null default 'EUR',
  card_on_file boolean not null default false,
  card_last4 text,
  card_brand text,
  stripe_customer_id text,
  stripe_subscription_id text,
  next_billing_at timestamptz,
  last_payment_at timestamptz,
  last_payment_status text,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.tenant_billing is
  'Subscription billing. provider=demo for trials without Stripe; stripe when STRIPE_* env is configured.';

create trigger tenant_billing_set_updated_at
  before update on public.tenant_billing
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- Staff invites (owner shares link; no email provider required for demo)
-- ---------------------------------------------------------------------------
create table if not exists public.tenant_invites (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  email text not null,
  role public.user_role not null,
  branch_id uuid references public.branches (id) on delete set null,
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  invited_by uuid references auth.users (id) on delete set null,
  invited_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  revoked_at timestamptz,
  constraint tenant_invites_role_staff check (
    role in ('manager', 'cashier', 'accountant', 'warehouse', 'delivery')
  )
);

create index tenant_invites_tenant_idx on public.tenant_invites (tenant_id);
create index tenant_invites_email_idx on public.tenant_invites (lower(email));
create index tenant_invites_token_idx on public.tenant_invites (token);

-- ---------------------------------------------------------------------------
-- Access helpers (used by app + optional RPC guards)
-- ---------------------------------------------------------------------------
create or replace function app.is_platform_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_platform_staff = true
  )
  or exists (
    select 1
    from public.user_tenants ut
    where ut.user_id = auth.uid()
      and ut.is_active = true
      and ut.role in ('super_admin', 'support_admin')
  );
$$;

create or replace function app.tenant_has_app_access(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tenants t
    where t.id = p_tenant_id
      and (
        app.is_platform_staff()
        or (
          t.status in ('trial', 'active', 'past_due')
          and (
            t.status <> 'trial'
            or t.trial_ends_at is null
            or t.trial_ends_at > now()
          )
        )
      )
  );
$$;

-- Backfill billing rows for existing tenants
insert into public.tenant_billing (tenant_id, card_on_file, next_billing_at)
select t.id, false, coalesce(t.trial_ends_at, now() + interval '30 days')
from public.tenants t
on conflict (tenant_id) do nothing;

-- Demo tenants with active trial get card_on_file for smoother demos
update public.tenant_billing tb
set card_on_file = true,
    card_last4 = '4242',
    card_brand = 'visa'
from public.tenants t
where tb.tenant_id = t.id
  and t.status in ('trial', 'active');

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.tenant_billing enable row level security;
alter table public.tenant_invites enable row level security;

create policy tenant_billing_member_select on public.tenant_billing
  for select using (
    tenant_id in (select app.current_user_tenant_ids())
    or app.is_platform_staff()
  );

create policy tenant_billing_owner_manage on public.tenant_billing
  for all using (
    app.has_tenant_role(tenant_id, array['owner']::text[])
    or app.is_platform_staff()
  )
  with check (
    app.has_tenant_role(tenant_id, array['owner']::text[])
    or app.is_platform_staff()
  );

create policy tenant_invites_member_select on public.tenant_invites
  for select using (
    tenant_id in (select app.current_user_tenant_ids())
    or app.is_platform_staff()
  );

create policy tenant_invites_admin_write on public.tenant_invites
  for insert with check (
    app.has_tenant_role(tenant_id, array['owner', 'manager']::text[])
    or app.is_platform_staff()
  );

create policy tenant_invites_admin_update on public.tenant_invites
  for update using (
    app.has_tenant_role(tenant_id, array['owner', 'manager']::text[])
    or app.is_platform_staff()
  );

drop policy if exists tenants_platform_update on public.tenants;
create policy tenants_platform_update on public.tenants
  for update using (app.is_platform_staff());

drop policy if exists profiles_platform_staff on public.profiles;
create policy profiles_platform_staff on public.profiles
  for update using (app.is_platform_staff());

-- ---------------------------------------------------------------------------
-- Accept invite (SECURITY DEFINER)
-- ---------------------------------------------------------------------------
create or replace function public.accept_tenant_invite(p_token text)
returns table (tenant_id uuid, role text, tenant_slug text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_invite public.tenant_invites%rowtype;
  v_slug text;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select * into v_invite
  from public.tenant_invites i
  where i.token = trim(p_token)
    and i.revoked_at is null
    and i.accepted_at is null
    and i.expires_at > now()
  for update;

  if not found then
    raise exception 'invite not found or expired' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.user_tenants ut
    where ut.user_id = v_user_id and ut.tenant_id = v_invite.tenant_id and ut.is_active = true
  ) then
    raise exception 'you already belong to this shop' using errcode = '42501';
  end if;

  insert into public.user_tenants (
    user_id, tenant_id, role, branch_id, is_active, invited_by, invited_at, accepted_at
  ) values (
    v_user_id, v_invite.tenant_id, v_invite.role, v_invite.branch_id, true,
    v_invite.invited_by, v_invite.invited_at, now()
  )
  on conflict do nothing;

  update public.tenant_invites
  set accepted_at = now(), accepted_by = v_user_id
  where id = v_invite.id;

  select t.slug into v_slug from public.tenants t where t.id = v_invite.tenant_id;

  return query select v_invite.tenant_id, v_invite.role::text, v_slug;
end;
$$;

grant execute on function public.accept_tenant_invite(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Provision billing row when tenant is created (extend RPC in app migration patch)
-- ---------------------------------------------------------------------------
create or replace function public.ensure_tenant_billing_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.tenant_billing (tenant_id, next_billing_at)
  values (new.id, coalesce(new.trial_ends_at, now() + interval '30 days'))
  on conflict (tenant_id) do nothing;
  return new;
end;
$$;

drop trigger if exists tenants_ensure_billing on public.tenants;
create trigger tenants_ensure_billing
  after insert on public.tenants
  for each row execute function public.ensure_tenant_billing_row();

-- >>> 20260605100000_billing_accounts_multi_shop_branches.sql
-- =============================================================================
-- Owner billing accounts (multi-shop tiers), branch limits, multi-shop RPC
-- =============================================================================

create table if not exists public.billing_accounts (
  id                      uuid primary key default gen_random_uuid(),
  owner_user_id           uuid not null references auth.users (id) on delete restrict,
  plan_shop_tier          int not null default 1 check (plan_shop_tier in (1, 5, 10, 15, 20, 25, 30)),
  plan_branch_tier        int not null default 1 check (plan_branch_tier in (1, 5, 10, 15, 20, 25, 30)),
  licensed_shop_count     int not null default 1 check (licensed_shop_count > 0),
  licensed_branch_count   int not null default 1 check (licensed_branch_count > 0),
  monthly_amount_cents    int not null default 2000 check (monthly_amount_cents >= 0),
  currency                text not null default 'EUR',
  provider                text not null default 'demo' check (provider in ('demo', 'stripe')),
  card_on_file            boolean not null default false,
  card_last4              text,
  card_brand              text,
  stripe_customer_id      text,
  stripe_subscription_id  text,
  next_billing_at         timestamptz,
  last_payment_at         timestamptz,
  last_payment_status     text,
  canceled_at             timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (owner_user_id)
);

comment on table public.billing_accounts is
  'One subscription per shop owner. Covers up to licensed_shop_count tenants and branch limits per shop.';

create trigger billing_accounts_set_updated_at
  before update on public.billing_accounts
  for each row execute function app.set_updated_at();

alter table public.tenants
  add column if not exists billing_account_id uuid references public.billing_accounts (id) on delete set null;

create index if not exists tenants_billing_account_idx on public.tenants (billing_account_id);

-- RLS: owners see their billing account
alter table public.billing_accounts enable row level security;

create policy billing_accounts_owner_select on public.billing_accounts
  for select to authenticated
  using (owner_user_id = auth.uid());

create policy billing_accounts_owner_update on public.billing_accounts
  for update to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

create policy billing_accounts_platform_all on public.billing_accounts
  for all to authenticated
  using (app.is_platform_staff())
  with check (app.is_platform_staff());

-- Count active shops under an owner's billing account
create or replace function app.owner_shop_count(p_owner_id uuid)
returns int
language sql stable security definer set search_path = ''
as $$
  select count(*)::int
  from public.tenants t
  join public.billing_accounts ba on ba.id = t.billing_account_id
  where ba.owner_user_id = p_owner_id;
$$;

-- Create or return billing account for owner
create or replace function app.ensure_billing_account(
  p_owner_id uuid,
  p_shop_tier int,
  p_branch_tier int,
  p_monthly_cents int
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  select id into v_id from public.billing_accounts where owner_user_id = p_owner_id;
  if v_id is not null then
    update public.billing_accounts
    set plan_shop_tier = p_shop_tier,
        plan_branch_tier = p_branch_tier,
        licensed_shop_count = p_shop_tier,
        licensed_branch_count = p_branch_tier,
        monthly_amount_cents = p_monthly_cents,
        updated_at = now()
    where id = v_id;
    return v_id;
  end if;

  insert into public.billing_accounts (
    owner_user_id, plan_shop_tier, plan_branch_tier,
    licensed_shop_count, licensed_branch_count, monthly_amount_cents
  ) values (
    p_owner_id, p_shop_tier, p_branch_tier, p_shop_tier, p_branch_tier, p_monthly_cents
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- Replace create_tenant_with_owner: supports first shop + additional shops under license
create or replace function public.create_tenant_with_owner(
  p_legal_name           text,
  p_display_name         text,
  p_slug                 text,
  p_vat_number           text default null,
  p_country              text default 'IE',
  p_currency             text default 'EUR',
  p_timezone             text default 'Europe/Dublin',
  p_locale               text default 'en-IE',
  p_branch_code          text default 'MAIN',
  p_branch_name          text default null,
  p_branch_address_line1 text default null,
  p_branch_city          text default null,
  p_branch_county        text default null,
  p_branch_eircode       text default null,
  p_plan_shop_tier       int default 1,
  p_plan_branch_tier     int default 1,
  p_monthly_amount_cents int default 2000
)
returns table (tenant_id uuid, branch_id uuid, slug text, billing_account_id uuid)
language plpgsql security definer set search_path = '' as $$
declare
  v_user_id            uuid := auth.uid();
  v_tenant_id          uuid;
  v_branch_id          uuid;
  v_slug               text := lower(trim(coalesce(p_slug, '')));
  v_attempt            text;
  v_counter            int := 0;
  v_branch_name        text;
  v_billing_account_id uuid;
  v_owned_shops        int;
  v_shop_tier          int := greatest(1, least(coalesce(p_plan_shop_tier, 1), 30));
  v_branch_tier        int := greatest(1, least(coalesce(p_plan_branch_tier, 1), 30));
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if v_slug is null or length(v_slug) < 2 then
    raise exception 'slug must be at least 2 characters' using errcode = '22023';
  end if;

  select ba.id into v_billing_account_id
  from public.billing_accounts ba
  where ba.owner_user_id = v_user_id;

  if v_billing_account_id is null then
    v_billing_account_id := app.ensure_billing_account(
      v_user_id, v_shop_tier, v_branch_tier, coalesce(p_monthly_amount_cents, 2000)
    );
  else
    select count(*)::int into v_owned_shops
    from public.tenants t
    where t.billing_account_id = v_billing_account_id;

    select licensed_shop_count into v_shop_tier
    from public.billing_accounts where id = v_billing_account_id;

    if v_owned_shops >= v_shop_tier then
      raise exception 'shop limit reached (%). Upgrade your plan to add more shops.', v_shop_tier
        using errcode = '42501';
    end if;
  end if;

  v_attempt := v_slug;
  while exists (select 1 from public.tenants t where t.slug = v_attempt) loop
    v_counter := v_counter + 1;
    if v_counter > 100 then
      raise exception 'could not find a unique slug for %', v_slug;
    end if;
    v_attempt := v_slug || '-' || v_counter::text;
  end loop;

  insert into public.tenants (
    slug, legal_name, display_name, vat_number,
    country, currency, timezone, default_locale,
    status, trial_ends_at, billing_account_id, created_by, updated_by
  ) values (
    v_attempt,
    trim(p_legal_name),
    trim(p_display_name),
    nullif(trim(coalesce(p_vat_number, '')), ''),
    coalesce(p_country, 'IE'),
    coalesce(p_currency, 'EUR'),
    coalesce(p_timezone, 'Europe/Dublin'),
    coalesce(p_locale, 'en-IE'),
    'trial',
    now() + interval '30 days',
    v_billing_account_id,
    v_user_id, v_user_id
  )
  returning id into v_tenant_id;

  v_branch_name := coalesce(nullif(trim(coalesce(p_branch_name, '')), ''), trim(p_display_name));
  insert into public.branches (
    tenant_id, code, name,
    address_line1, city, county, eircode,
    country, timezone, is_active, created_by, updated_by
  ) values (
    v_tenant_id,
    upper(coalesce(nullif(trim(coalesce(p_branch_code, '')), ''), 'MAIN')),
    v_branch_name,
    nullif(trim(coalesce(p_branch_address_line1, '')), ''),
    nullif(trim(coalesce(p_branch_city, '')), ''),
    nullif(trim(coalesce(p_branch_county, '')), ''),
    nullif(trim(coalesce(p_branch_eircode, '')), ''),
    coalesce(p_country, 'IE'),
    coalesce(p_timezone, 'Europe/Dublin'),
    true,
    v_user_id, v_user_id
  )
  returning id into v_branch_id;

  insert into public.user_tenants (
    user_id, tenant_id, role, branch_id, is_active, accepted_at
  ) values (
    v_user_id, v_tenant_id, 'owner', null, true, now()
  );

  insert into public.tenant_storefronts (tenant_id, branch_id, enabled, hero_title)
  values (v_tenant_id, v_branch_id, true, trim(p_display_name))
  on conflict (tenant_id) do update set branch_id = excluded.branch_id;

  return query select v_tenant_id, v_branch_id, v_attempt, v_billing_account_id;
end;
$$;

-- Add branch (respect licensed_branch_count per tenant)
create or replace function public.add_branch_for_tenant(
  p_tenant_id uuid,
  p_code text,
  p_name text,
  p_address_line1 text default null,
  p_city text default null,
  p_county text default null,
  p_eircode text default null
)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid := auth.uid();
  v_branch_id uuid;
  v_count int;
  v_limit int;
  v_billing_id uuid;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not app.has_tenant_role(p_tenant_id, array['owner', 'manager']::public.user_role[]) then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  select t.billing_account_id into v_billing_id from public.tenants t where t.id = p_tenant_id;
  select coalesce(ba.licensed_branch_count, 1) into v_limit
  from public.billing_accounts ba
  where ba.id = v_billing_id;

  select count(*)::int into v_count from public.branches b where b.tenant_id = p_tenant_id and b.is_active;

  if v_count >= v_limit then
    raise exception 'branch limit reached (%). Upgrade your plan.', v_limit using errcode = '42501';
  end if;

  insert into public.branches (
    tenant_id, code, name, address_line1, city, county, eircode, is_active, created_by, updated_by
  ) values (
    p_tenant_id,
    upper(trim(p_code)),
    trim(p_name),
    nullif(trim(coalesce(p_address_line1, '')), ''),
    nullif(trim(coalesce(p_city, '')), ''),
    nullif(trim(coalesce(p_county, '')), ''),
    nullif(trim(coalesce(p_eircode, '')), ''),
    true,
    v_user_id, v_user_id
  )
  returning id into v_branch_id;

  return v_branch_id;
end;
$$;

grant execute on function public.add_branch_for_tenant(uuid, text, text, text, text, text, text) to authenticated;

revoke execute on function public.create_tenant_with_owner(
  text, text, text, text, text, text, text, text, text, text, text, text, text, text,
  int, int, int
) from public, anon;
grant execute on function public.create_tenant_with_owner(
  text, text, text, text, text, text, text, text, text, text, text, text, text, text,
  int, int, int
) to authenticated;

-- Backfill billing accounts for existing owners (one account per owner, first tenant's billing)
insert into public.billing_accounts (owner_user_id, plan_shop_tier, plan_branch_tier, licensed_shop_count, licensed_branch_count, monthly_amount_cents, provider, card_on_file, card_last4, card_brand)
select distinct on (ut.user_id)
  ut.user_id,
  1, 1, 1, 1,
  coalesce(tb.monthly_amount_cents, 2000),
  coalesce(tb.provider, 'demo'),
  coalesce(tb.card_on_file, false),
  tb.card_last4,
  tb.card_brand
from public.user_tenants ut
join public.tenants t on t.id = ut.tenant_id
left join public.tenant_billing tb on tb.tenant_id = t.id
where ut.role = 'owner' and ut.is_active = true
  and not exists (select 1 from public.billing_accounts ba where ba.owner_user_id = ut.user_id)
order by ut.user_id, t.created_at;

update public.tenants t
set billing_account_id = sub.ba_id
from (
  select t2.id as tenant_id, ba.id as ba_id
  from public.tenants t2
  inner join public.user_tenants ut
    on ut.tenant_id = t2.id and ut.role = 'owner' and ut.is_active = true
  inner join public.billing_accounts ba on ba.owner_user_id = ut.user_id
) sub
where t.id = sub.tenant_id and t.billing_account_id is null;

