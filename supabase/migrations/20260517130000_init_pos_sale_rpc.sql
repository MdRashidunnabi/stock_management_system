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
