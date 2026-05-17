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
