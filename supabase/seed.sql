-- =============================================================================
-- ShopOS - Dev seed (loaded by `supabase db reset`)
-- =============================================================================
-- This file is for LOCAL DEVELOPMENT ONLY. It's idempotent: running it twice
-- has no extra effect.
--
-- It seeds:
--   - 1 demo tenant: "Greenway Mini Market" (Dublin)
--   - 1 demo branch: "Greenway - Phibsborough"
--   - 1 POS terminal
--   - 5 categories, 3 brands, ~20 sample products with IE VAT codes
--   - 2 suppliers
--
-- Demo users (sign in as):
--   owner@demo.shopos.local   / DemoPass123!
--   cashier@demo.shopos.local / DemoPass123!
--
-- These users must be created via Supabase Auth (manually in Studio, or by
-- running `npm run db:seed` which uses the admin client). This SQL file
-- only seeds data once the auth users exist.
-- =============================================================================

-- Look up demo users (fall back to NULL if not yet created)
do $$
declare
  v_owner_id   uuid;
  v_cashier_id uuid;
  v_tenant_id  uuid := '00000000-0000-0000-0000-000000000001';
  v_branch_id  uuid := '00000000-0000-0000-0000-000000000010';
  v_terminal_id uuid := '00000000-0000-0000-0000-000000000020';
begin
  select id into v_owner_id from auth.users where email = 'owner@demo.shopos.local' limit 1;
  select id into v_cashier_id from auth.users where email = 'cashier@demo.shopos.local' limit 1;

  -- Tenant
  insert into public.tenants (id, slug, legal_name, display_name, vat_number, country, status, trial_ends_at)
  values (v_tenant_id, 'greenway', 'Greenway Mini Market Ltd', 'Greenway Mini Market', 'IE1234567T', 'IE', 'trial', now() + interval '30 days')
  on conflict (id) do nothing;

  -- Branch
  insert into public.branches (id, tenant_id, code, name, address_line1, city, county, eircode)
  values (v_branch_id, v_tenant_id, 'PHIB', 'Greenway - Phibsborough', '12 North Circular Rd', 'Dublin', 'Dublin', 'D07 XY12')
  on conflict (id) do nothing;

  -- POS terminal
  insert into public.pos_terminals (id, tenant_id, branch_id, code, name)
  values (v_terminal_id, v_tenant_id, v_branch_id, 'T1', 'Front till')
  on conflict (id) do nothing;

  -- User memberships (only if the auth users exist)
  if v_owner_id is not null then
    insert into public.user_tenants (user_id, tenant_id, role, is_active, accepted_at)
    values (v_owner_id, v_tenant_id, 'owner', true, now())
    on conflict do nothing;
  end if;

  if v_cashier_id is not null then
    insert into public.user_tenants (user_id, tenant_id, role, is_active, accepted_at, branch_id)
    values (v_cashier_id, v_tenant_id, 'cashier', true, now(), v_branch_id)
    on conflict do nothing;
  end if;

  -- Categories
  insert into public.categories (tenant_id, name, slug, position) values
    (v_tenant_id, 'Drinks', 'drinks', 1),
    (v_tenant_id, 'Snacks', 'snacks', 2),
    (v_tenant_id, 'Bakery', 'bakery', 3),
    (v_tenant_id, 'Dairy', 'dairy', 4),
    (v_tenant_id, 'Household', 'household', 5)
  on conflict (tenant_id, slug) do nothing;

  -- Brands
  insert into public.brands (tenant_id, name, slug) values
    (v_tenant_id, 'Tayto', 'tayto'),
    (v_tenant_id, 'Brennans', 'brennans'),
    (v_tenant_id, 'Kerrygold', 'kerrygold')
  on conflict (tenant_id, slug) do nothing;

  -- Suppliers
  insert into public.suppliers (id, tenant_id, code, name, country, payment_terms)
  values
    ('00000000-0000-0000-0000-000000000100', v_tenant_id, 'MUSGRAVE', 'Musgrave Wholesale', 'IE', 'Net 30'),
    ('00000000-0000-0000-0000-000000000101', v_tenant_id, 'BWG', 'BWG Foods', 'IE', 'Net 14')
  on conflict (id) do nothing;

  -- Sample products
  insert into public.products
    (tenant_id, name, sku, barcode, category_id, brand_id, default_supplier_id,
     purchase_price, selling_price, vat_code, vat_included, base_unit, is_active)
  select
    v_tenant_id,
    p.name,
    p.sku,
    p.barcode,
    (select id from public.categories where tenant_id = v_tenant_id and slug = p.cat),
    (select id from public.brands where tenant_id = v_tenant_id and slug = p.brand),
    (select id from public.suppliers where tenant_id = v_tenant_id and code = p.supplier),
    p.purchase, p.price, p.vat::public.vat_code, true, p.unit, true
  from (values
    ('Tayto Cheese & Onion 45g', 'TYT-CO-45', '5099876001234', 'snacks', 'tayto', 'BWG', 0.55, 1.20, 'STD', 'un'),
    ('Tayto Salt & Vinegar 45g',  'TYT-SV-45', '5099876001241', 'snacks', 'tayto', 'BWG', 0.55, 1.20, 'STD', 'un'),
    ('Brennans Sliced Pan 800g',  'BRN-WP-800', '5099876002001', 'bakery', 'brennans', 'BWG', 1.10, 2.49, 'ZER', 'un'),
    ('Brennans Wholemeal 800g',   'BRN-WM-800', '5099876002018', 'bakery', 'brennans', 'BWG', 1.20, 2.79, 'ZER', 'un'),
    ('Kerrygold Butter 250g',     'KRG-BT-250', '5099876003001', 'dairy', 'kerrygold', 'MUSGRAVE', 1.80, 3.49, 'ZER', 'un'),
    ('Avonmore Milk 1L',          'AVN-MK-1L',  '5099876004001', 'dairy', null, 'MUSGRAVE', 0.85, 1.69, 'ZER', 'L'),
    ('Coca-Cola 500ml',           'CC-500',     '5099876005001', 'drinks', null, 'BWG', 0.85, 1.99, 'STD', 'un'),
    ('7Up 500ml',                 '7UP-500',    '5099876005018', 'drinks', null, 'BWG', 0.85, 1.99, 'STD', 'un'),
    ('Sparkling Water 500ml',     'SPW-500',    '5099876005025', 'drinks', null, 'BWG', 0.35, 0.99, 'STD', 'un'),
    ('Bin Bags 30L x10',          'HH-BIN-30',  '5099876006001', 'household', null, 'MUSGRAVE', 1.40, 2.99, 'STD', 'un')
  ) as p(name, sku, barcode, cat, brand, supplier, purchase, price, vat, unit)
  on conflict (tenant_id, sku) do nothing;
end $$;
