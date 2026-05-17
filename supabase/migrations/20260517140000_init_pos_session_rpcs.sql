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
