-- Needs loyalty vouchers.
-- A voucher is earned on the product total after any voucher already used.
-- Delivery is never discounted. The spendable code is created only when
-- staff confirm payment. Until then the customer sees the amount and the
-- 30-day rule, with no code.

alter table public.tenant_storefronts
  drop constraint if exists tenant_storefronts_theme_id_chk;

alter table public.tenant_storefronts
  add constraint tenant_storefronts_theme_id_chk
  check (
    theme_id in (
      'market', 'noir', 'linen', 'harbor', 'blossom',
      'harvest', 'metro', 'grove', 'sunset', 'slate', 'needs'
    )
  );

update public.tenant_storefronts
   set theme_id = 'needs'
 where tenant_id in (select id from public.tenants where slug = 'needscarlow')
   and theme_id is distinct from 'needs';

alter table public.online_orders
  add column if not exists voucher_discount numeric(12,2) not null default 0,
  add column if not exists voucher_code_used text,
  add column if not exists external_items jsonb;

create table if not exists public.customer_vouchers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  source_order_id uuid references public.online_orders(id) on delete set null,
  customer_name text,
  customer_phone text not null,
  amount numeric(12,2) not null check (amount > 0),
  eligible_spend numeric(12,2) not null default 0,
  status text not null default 'pending' check (status in ('pending', 'active', 'redeemed', 'void')),
  code text,
  expires_at timestamptz,
  issued_at timestamptz,
  redeemed_at timestamptz,
  redeemed_order_id uuid references public.online_orders(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists customer_vouchers_code_uidx
  on public.customer_vouchers (code)
  where code is not null;

create index if not exists customer_vouchers_source_idx
  on public.customer_vouchers (source_order_id);

alter table public.customer_vouchers enable row level security;

create or replace function app.voucher_earn(p_eligible numeric)
returns numeric
language sql
immutable
as $$
  select case
    when round(greatest(p_eligible, 0) * 0.05, 2) >= 0.01
      then round(greatest(p_eligible, 0) * 0.05, 2)
    else 0
  end
$$;

create or replace function app.issue_pending_voucher(
  p_tenant uuid,
  p_order uuid,
  p_name text,
  p_phone text,
  p_products numeric,
  p_discount numeric
) returns numeric
language plpgsql
as $$
declare
  v_eligible numeric := round(greatest(p_products - p_discount, 0), 2);
  v_earn numeric := app.voucher_earn(v_eligible);
begin
  if v_earn <= 0 then
    return 0;
  end if;
  insert into public.customer_vouchers (
    tenant_id, source_order_id, customer_name, customer_phone,
    amount, eligible_spend, status
  ) values (
    p_tenant, p_order, p_name, p_phone, v_earn, v_eligible, 'pending'
  );
  return v_earn;
end;
$$;

create or replace function app.take_voucher(
  p_tenant uuid,
  p_code text,
  p_products numeric,
  p_order uuid
) returns numeric
language plpgsql
as $$
declare
  v_row public.customer_vouchers%rowtype;
  v_discount numeric;
begin
  if coalesce(trim(p_code), '') = '' then
    return 0;
  end if;

  select * into v_row
    from public.customer_vouchers
   where tenant_id = p_tenant
     and code = upper(trim(p_code))
   for update;

  if not found then
    raise exception 'voucher: code not found' using errcode = '22023';
  end if;
  if v_row.status <> 'active' then
    raise exception 'voucher: code is no longer valid' using errcode = '22023';
  end if;
  if v_row.expires_at is not null and v_row.expires_at < now() then
    update public.customer_vouchers set status = 'void' where id = v_row.id;
    raise exception 'voucher: code has passed its deadline' using errcode = '22023';
  end if;

  v_discount := round(least(v_row.amount, greatest(p_products, 0)), 2);
  update public.customer_vouchers
     set status = 'redeemed',
         redeemed_at = now(),
         redeemed_order_id = p_order
   where id = v_row.id;
  return v_discount;
end;
$$;

create or replace function public.record_needs_web_order(
  p_customer jsonb,
  p_items jsonb,
  p_products_total numeric,
  p_delivery_fee numeric,
  p_code text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid;
  v_branch uuid;
  v_order uuid := gen_random_uuid();
  v_number text;
  v_products numeric := round(greatest(coalesce(p_products_total, 0), 0), 2);
  v_fee numeric := round(greatest(coalesce(p_delivery_fee, 0), 0), 2);
  v_discount numeric := 0;
  v_earn numeric := 0;
  v_total numeric;
  v_name text := trim(coalesce(p_customer->>'name', ''));
  v_phone text := trim(coalesce(p_customer->>'phone', ''));
  v_fulfillment public.online_fulfillment_type;
  v_payment public.online_checkout_payment;
begin
  select t.id, coalesce(s.branch_id, (
           select b.id from public.branches b
            where b.tenant_id = t.id
            order by b.created_at
            limit 1
         ))
    into v_tenant, v_branch
    from public.tenants t
    left join public.tenant_storefronts s on s.tenant_id = t.id
   where t.slug = 'needscarlow'
   limit 1;

  if v_tenant is null or v_branch is null then
    raise exception 'record_needs_web_order: Needs shop is not ready';
  end if;
  if length(v_name) < 2 or length(v_phone) < 6 then
    raise exception 'record_needs_web_order: name and phone are required';
  end if;

  v_fulfillment := case when coalesce(p_customer->>'fulfillment', 'delivery') = 'collection'
    then 'takeaway'::public.online_fulfillment_type
    else 'delivery'::public.online_fulfillment_type end;
  v_payment := case when coalesce(p_customer->>'payment', 'cod') = 'card'
    then 'online_card'::public.online_checkout_payment
    else 'cod'::public.online_checkout_payment end;

  v_total := round(v_products + v_fee, 2);
  v_number := app.next_online_order_number(v_tenant);

  insert into public.online_orders (
    id, tenant_id, branch_id, order_number, status,
    customer_name, customer_phone, customer_email, delivery_address, notes,
    fulfillment_type, payment_method,
    products_total, delivery_fee, subtotal, vat_total, total,
    voucher_discount, voucher_code_used, external_items,
    wanted_for_date, is_advance
  ) values (
    v_order, v_tenant, v_branch, v_number, 'pending',
    v_name, v_phone,
    nullif(trim(coalesce(p_customer->>'email', '')), ''),
    nullif(trim(coalesce(p_customer->>'address', '')), ''),
    nullif(trim(coalesce(p_customer->>'notes', '')), ''),
    v_fulfillment, v_payment,
    v_products, v_fee, v_total, 0, v_total,
    v_discount, nullif(upper(trim(coalesce(p_code, ''))), ''),
    coalesce(p_items, '[]'::jsonb),
    nullif(p_customer->>'wanted_for_date', '')::date,
    coalesce((p_customer->>'is_advance')::boolean, false)
  );

  if coalesce(trim(p_code), '') <> '' then
    v_discount := app.take_voucher(v_tenant, p_code, v_products, v_order);
    v_total := round(greatest(v_products - v_discount, 0) + v_fee, 2);
    update public.online_orders
       set voucher_discount = v_discount,
           voucher_code_used = upper(trim(p_code)),
           total = v_total,
           subtotal = v_total
     where id = v_order;
  end if;

  insert into public.payments (
    tenant_id, online_order_id, method, amount, status
  ) values (
    v_tenant, v_order,
    case when v_payment = 'online_card' then 'card'::public.payment_method else 'cash'::public.payment_method end,
    v_total, 'pending'
  );

  v_earn := app.issue_pending_voucher(v_tenant, v_order, v_name, v_phone, v_products, v_discount);

  return jsonb_build_object(
    'order_id', v_order,
    'order_number', v_number,
    'discount', v_discount,
    'products_total', v_products,
    'delivery_fee', v_fee,
    'total', v_total,
    'earned', v_earn,
    'valid_days', 30
  );
end;
$$;

revoke all on function public.record_needs_web_order(jsonb, jsonb, numeric, numeric, text) from public, anon, authenticated;
grant execute on function public.record_needs_web_order(jsonb, jsonb, numeric, numeric, text) to service_role;

create or replace function public.apply_online_order_voucher(
  p_order_id uuid,
  p_code text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.online_orders%rowtype;
  v_discount numeric;
  v_total numeric;
  v_earn numeric;
begin
  select * into v_order from public.online_orders where id = p_order_id for update;
  if not found then
    raise exception 'apply_online_order_voucher: order not found';
  end if;
  v_discount := coalesce(v_order.voucher_discount, 0);
  v_total := v_order.total;

  if coalesce(trim(p_code), '') <> '' and v_discount = 0 then
    v_discount := app.take_voucher(v_order.tenant_id, p_code, v_order.products_total, v_order.id);
    v_total := round(greatest(v_order.products_total - v_discount, 0) + v_order.delivery_fee, 2);
    update public.online_orders
       set voucher_discount = v_discount,
           voucher_code_used = upper(trim(p_code)),
           total = v_total,
           subtotal = v_total
     where id = v_order.id;
    update public.payments
       set amount = v_total
     where online_order_id = v_order.id
       and status = 'pending';
    update public.sales
       set total = v_total,
           discount_total = v_discount
     where id = v_order.sale_id;
  end if;

  if not exists (
    select 1 from public.customer_vouchers
     where source_order_id = v_order.id
       and status in ('pending', 'active', 'redeemed')
  ) then
    v_earn := app.issue_pending_voucher(
      v_order.tenant_id, v_order.id, v_order.customer_name, v_order.customer_phone,
      v_order.products_total, v_discount
    );
  else
    select amount into v_earn
      from public.customer_vouchers
     where source_order_id = v_order.id
     order by created_at
     limit 1;
  end if;

  return jsonb_build_object(
    'discount', v_discount,
    'total', v_total,
    'earned', v_earn,
    'valid_days', 30
  );
end;
$$;

revoke all on function public.apply_online_order_voucher(uuid, text) from public, anon;
grant execute on function public.apply_online_order_voucher(uuid, text) to service_role;

create or replace function public.confirm_online_order_payment(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_order public.online_orders%rowtype;
  v_voucher public.customer_vouchers%rowtype;
  v_code text;
begin
  if v_user is null then
    raise exception 'confirm_online_order_payment: must be authenticated' using errcode = '42501';
  end if;
  select * into v_order from public.online_orders where id = p_order_id for update;
  if not found then
    raise exception 'confirm_online_order_payment: order not found';
  end if;
  if not app.has_tenant_role(v_order.tenant_id, array['owner','manager','warehouse','delivery']::text[])
     and not app.is_super_admin() then
    raise exception 'confirm_online_order_payment: not allowed' using errcode = '42501';
  end if;
  if v_order.status = 'cancelled' then
    raise exception 'This order is cancelled.';
  end if;

  update public.payments
     set status = 'captured',
         captured_at = coalesce(captured_at, now())
   where online_order_id = p_order_id
     and status in ('pending', 'authorised');

  update public.online_orders
     set status = case when status = 'pending' then 'confirmed'::public.online_order_status else status end
   where id = p_order_id;

  select * into v_voucher
    from public.customer_vouchers
   where source_order_id = p_order_id
     and status = 'pending'
   order by created_at
   limit 1
   for update;

  if not found then
    select * into v_voucher
      from public.customer_vouchers
     where source_order_id = p_order_id
       and status = 'active'
     limit 1;
    if not found then
      return jsonb_build_object('issued', false, 'amount', 0);
    end if;
    return jsonb_build_object(
      'issued', true,
      'amount', v_voucher.amount,
      'code', v_voucher.code,
      'expires_at', v_voucher.expires_at,
      'eligible_spend', v_voucher.eligible_spend
    );
  end if;

  v_code := 'NC' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  update public.customer_vouchers
     set status = 'active',
         code = v_code,
         issued_at = now(),
         expires_at = now() + interval '30 days'
   where id = v_voucher.id;

  return jsonb_build_object(
    'issued', true,
    'amount', v_voucher.amount,
    'code', v_code,
    'expires_at', now() + interval '30 days',
    'eligible_spend', v_voucher.eligible_spend
  );
end;
$$;

revoke all on function public.confirm_online_order_payment(uuid) from public, anon;
grant execute on function public.confirm_online_order_payment(uuid) to authenticated;

create or replace function public.get_online_order_voucher(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_order public.online_orders%rowtype;
  v_voucher public.customer_vouchers%rowtype;
  v_payment text;
begin
  if v_user is null then
    raise exception 'get_online_order_voucher: must be authenticated' using errcode = '42501';
  end if;
  select * into v_order from public.online_orders where id = p_order_id;
  if not found then
    return null;
  end if;
  if not app.has_tenant_role(v_order.tenant_id, array['owner','manager','warehouse','delivery']::text[])
     and not app.is_super_admin() then
    raise exception 'get_online_order_voucher: not allowed' using errcode = '42501';
  end if;

  select status into v_payment
    from public.payments
   where online_order_id = p_order_id
   order by created_at
   limit 1;

  select * into v_voucher
    from public.customer_vouchers
   where source_order_id = p_order_id
     and status in ('pending', 'active', 'redeemed')
   order by created_at
   limit 1;

  return jsonb_build_object(
    'discount', coalesce(v_order.voucher_discount, 0),
    'code_used', v_order.voucher_code_used,
    'payment_status', v_payment,
    'external_items', coalesce(v_order.external_items, '[]'::jsonb),
    'earned_amount', coalesce(v_voucher.amount, 0),
    'earned_status', v_voucher.status,
    'earned_code', v_voucher.code,
    'expires_at', v_voucher.expires_at,
    'eligible_spend', coalesce(v_voucher.eligible_spend, 0)
  );
end;
$$;

revoke all on function public.get_online_order_voucher(uuid) from public, anon;
grant execute on function public.get_online_order_voucher(uuid) to authenticated;

create or replace function public.quote_needs_voucher(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.customer_vouchers%rowtype;
  v_tenant uuid;
begin
  select id into v_tenant from public.tenants where slug = 'needscarlow' limit 1;
  select * into v_row
    from public.customer_vouchers
   where tenant_id = v_tenant
     and code = upper(trim(coalesce(p_code, '')));
  if not found or v_row.status <> 'active' then
    return jsonb_build_object('ok', false, 'error', 'That voucher code is not valid.');
  end if;
  if v_row.expires_at is not null and v_row.expires_at < now() then
    return jsonb_build_object('ok', false, 'error', 'That voucher has passed its deadline.');
  end if;
  return jsonb_build_object('ok', true, 'amount', v_row.amount, 'expires_at', v_row.expires_at);
end;
$$;

revoke all on function public.quote_needs_voucher(text) from public, anon, authenticated;
grant execute on function public.quote_needs_voucher(text) to service_role;

create or replace function public.track_needs_order(p_order text, p_phone text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.online_orders%rowtype;
  v_voucher public.customer_vouchers%rowtype;
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\s', '', 'g');
begin
  select * into v_order
    from public.online_orders o
    join public.tenants t on t.id = o.tenant_id
   where t.slug = 'needscarlow'
     and upper(o.order_number) = upper(trim(p_order))
     and regexp_replace(o.customer_phone, '\s', '', 'g') = v_phone
   limit 1;
  if not found then
    return jsonb_build_object('ok', false);
  end if;
  select * into v_voucher
    from public.customer_vouchers
   where source_order_id = v_order.id
   order by created_at
   limit 1;
  return jsonb_build_object(
    'ok', true,
    'order_number', v_order.order_number,
    'status', v_order.status,
    'total', v_order.total,
    'fulfillment', v_order.fulfillment_type,
    'discount', coalesce(v_order.voucher_discount, 0),
    'earned', coalesce(v_voucher.amount, 0),
    'earned_status', v_voucher.status,
    'expires_at', v_voucher.expires_at
  );
end;
$$;

revoke all on function public.track_needs_order(text, text) from public, anon, authenticated;
grant execute on function public.track_needs_order(text, text) to service_role;
