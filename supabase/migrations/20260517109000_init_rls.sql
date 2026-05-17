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
