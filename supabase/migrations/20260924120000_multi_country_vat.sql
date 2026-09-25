-- Multi-country VAT: store rates on the tenant and look them up in sale / PO / online RPCs.

alter table public.tenants
  add column if not exists vat_rates jsonb not null default '{
    "STD": 0.23, "RED": 0.135, "SEC": 0.09, "LIV": 0.048, "ZER": 0, "EXE": 0
  }'::jsonb;

comment on column public.tenants.vat_rates is
  'Shop VAT/GST bands keyed by vat_code (STD/RED/SEC/LIV/ZER/EXE). Set from the country chosen at signup.';

alter table public.profiles
  add column if not exists country text;

create or replace function app.handle_new_auth_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  set local row_security = off;
  insert into public.profiles (id, email, full_name, locale, country)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(nullif(new.raw_user_meta_data->>'locale', ''), 'en'),
    nullif(upper(new.raw_user_meta_data->>'country'), '')
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(public.profiles.full_name, excluded.full_name),
        country = coalesce(public.profiles.country, excluded.country);
  return new;
end;
$$;

create or replace function app.vat_rate(p_tenant_id uuid, p_code public.vat_code)
returns numeric
language plpgsql stable security definer set search_path = '' as $$
declare
  v_rates jsonb;
  v_rate numeric;
begin
  select vat_rates into v_rates from public.tenants where id = p_tenant_id;
  if v_rates is not null and v_rates ? p_code::text then
    v_rate := (v_rates->>p_code::text)::numeric;
    if v_rate is not null then
      return v_rate;
    end if;
  end if;
  return case p_code
    when 'STD' then 0.2300
    when 'RED' then 0.1350
    when 'SEC' then 0.0900
    when 'LIV' then 0.0480
    else 0.0000
  end;
end;
$$;

-- Tenant create: persist country VAT bands
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
  p_monthly_amount_cents int default 2000,
  p_vat_rates            jsonb default null
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
    country, currency, timezone, default_locale, vat_rates,
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
    coalesce(p_vat_rates, '{"STD":0.23,"RED":0.135,"SEC":0.09,"LIV":0.048,"ZER":0,"EXE":0}'::jsonb),
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

-- Sale / online / purchasing VAT lookup
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

    v_vat_rate := app.vat_rate(v_tenant_id, v_vat_code);

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

create or replace function public.commit_online_order(
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

    v_vat_rate := app.vat_rate(v_tenant_id, v_vat_code);

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

    v_vatrate := app.vat_rate(v_tenant_id, v_vatcode);

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
