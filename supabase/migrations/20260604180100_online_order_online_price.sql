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
