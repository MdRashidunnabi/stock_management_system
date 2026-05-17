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
