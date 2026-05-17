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
