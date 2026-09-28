-- Shop operations: fulfillment tracking, line substitutes/refunds, advance orders.

do $$ begin
  create type public.online_fulfillment_stage as enum (
    'preparing',
    'prepared_for_delivery',
    'on_the_way',
    'delivered',
    'ready_for_collection',
    'collected'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.online_unavailable_policy as enum ('substitute', 'omit');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.online_line_status as enum ('ok', 'substituted', 'omitted', 'refunded');
exception when duplicate_object then null;
end $$;

alter table public.online_orders
  add column if not exists fulfillment_stage public.online_fulfillment_stage not null default 'preparing';

alter table public.online_orders
  add column if not exists wanted_for_date date;

alter table public.online_orders
  add column if not exists is_advance boolean not null default false;

alter table public.online_order_items
  add column if not exists unavailable_policy public.online_unavailable_policy not null default 'omit';

alter table public.online_order_items
  add column if not exists line_status public.online_line_status not null default 'ok';

alter table public.online_order_items
  add column if not exists original_product_id uuid references public.products(id);

alter table public.online_order_items
  add column if not exists refunded_amount numeric(14,4) not null default 0;

create index if not exists online_orders_wanted_for_idx
  on public.online_orders (tenant_id, wanted_for_date);

create or replace function public.set_online_fulfillment_stage(
  p_order_id uuid,
  p_stage public.online_fulfillment_stage
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_order public.online_orders%rowtype;
  v_status public.online_order_status;
begin
  if v_user is null then
    raise exception 'set_online_fulfillment_stage: must be authenticated' using errcode = '42501';
  end if;

  select * into v_order from public.online_orders where id = p_order_id;
  if not found then
    raise exception 'set_online_fulfillment_stage: order not found' using errcode = '23503';
  end if;

  if not app.has_tenant_role(
       v_order.tenant_id,
       array['owner','manager','warehouse','delivery']::text[]
     )
     and not app.is_super_admin() then
    raise exception 'set_online_fulfillment_stage: not allowed' using errcode = '42501';
  end if;

  if v_order.status = 'cancelled' then
    raise exception 'This order is cancelled.';
  end if;

  if v_order.fulfillment_type = 'delivery' then
    if p_stage not in (
      'preparing'::public.online_fulfillment_stage,
      'prepared_for_delivery'::public.online_fulfillment_stage,
      'on_the_way'::public.online_fulfillment_stage,
      'delivered'::public.online_fulfillment_stage
    ) then
      raise exception 'That stage is for collection orders.';
    end if;
  else
    if p_stage not in (
      'preparing'::public.online_fulfillment_stage,
      'ready_for_collection'::public.online_fulfillment_stage,
      'collected'::public.online_fulfillment_stage
    ) then
      raise exception 'That stage is for delivery orders.';
    end if;
  end if;

  v_status := v_order.status;
  if v_status = 'pending' then
    v_status := 'confirmed';
  end if;
  if p_stage in (
    'delivered'::public.online_fulfillment_stage,
    'collected'::public.online_fulfillment_stage
  ) then
    v_status := 'fulfilled';
  end if;

  update public.online_orders
     set fulfillment_stage = p_stage,
         status = v_status,
         updated_at = now()
   where id = p_order_id;

  return p_order_id;
end;
$$;

revoke execute on function public.set_online_fulfillment_stage(uuid, public.online_fulfillment_stage) from anon, public;
grant execute on function public.set_online_fulfillment_stage(uuid, public.online_fulfillment_stage) to authenticated;

create or replace function public.resolve_online_order_line(
  p_item_id uuid,
  p_action text,
  p_substitute_product_id uuid default null
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_item public.online_order_items%rowtype;
  v_order public.online_orders%rowtype;
  v_sub public.products%rowtype;
  v_qty numeric;
  v_refund numeric;
  v_pay public.payments%rowtype;
begin
  if v_user is null then
    raise exception 'resolve_online_order_line: must be authenticated' using errcode = '42501';
  end if;

  select * into v_item from public.online_order_items where id = p_item_id;
  if not found then
    raise exception 'resolve_online_order_line: line not found' using errcode = '23503';
  end if;

  select * into v_order from public.online_orders where id = v_item.online_order_id;
  if not app.has_tenant_role(
       v_order.tenant_id,
       array['owner','manager','warehouse','delivery']::text[]
     )
     and not app.is_super_admin() then
    raise exception 'resolve_online_order_line: not allowed' using errcode = '42501';
  end if;

  if v_item.line_status <> 'ok' then
    raise exception 'This line is already settled.';
  end if;

  v_qty := v_item.quantity;

  if p_action = 'omit' then
    perform app.apply_stock_movement(
      v_order.tenant_id, v_order.branch_id, v_item.product_id, null, null,
      'return'::public.stock_movement_type,
      'sold'::public.stock_state, 'available'::public.stock_state,
      v_qty, 0, 'online_order', v_order.id, v_user,
      'Online line omitted / refunded'
    );

    v_refund := v_item.line_total_gross;

    update public.online_order_items
       set line_status = 'refunded',
           refunded_amount = v_refund
     where id = p_item_id;

    select * into v_pay
      from public.payments
     where online_order_id = v_order.id
     order by created_at
     limit 1;

    if found then
      if v_pay.status = 'captured' then
        update public.payments
           set refunded_amount = coalesce(refunded_amount, 0) + v_refund,
               refunded_at = now(),
               status = case
                 when coalesce(refunded_amount, 0) + v_refund >= amount - 0.005 then 'refunded'
                 else status
               end
         where id = v_pay.id;
      else
        update public.payments
           set amount = greatest(0, amount - v_refund)
         where id = v_pay.id;
      end if;
    end if;

    update public.online_orders
       set products_total = greatest(0, products_total - v_refund),
           total = greatest(0, total - v_refund),
           updated_at = now()
     where id = v_order.id;

  elsif p_action = 'substitute' then
    if p_substitute_product_id is null then
      raise exception 'Pick a similar product to send instead.';
    end if;

    select * into v_sub from public.products
     where id = p_substitute_product_id and tenant_id = v_order.tenant_id and is_active;
    if not found then
      raise exception 'Substitute product not found.';
    end if;

    perform app.apply_stock_movement(
      v_order.tenant_id, v_order.branch_id, v_item.product_id, null, null,
      'return'::public.stock_movement_type,
      'sold'::public.stock_state, 'available'::public.stock_state,
      v_qty, 0, 'online_order', v_order.id, v_user,
      'Replaced with similar product'
    );

    perform app.apply_stock_movement(
      v_order.tenant_id, v_order.branch_id, v_sub.id, null, null,
      'pos_sale'::public.stock_movement_type,
      'available'::public.stock_state, 'sold'::public.stock_state,
      v_qty, coalesce(v_sub.purchase_price, 0), 'online_order', v_order.id, v_user,
      'Similar product sent'
    );

    update public.online_order_items
       set original_product_id = coalesce(original_product_id, product_id),
           product_id = v_sub.id,
           name_snapshot = v_sub.name,
           sku_snapshot = v_sub.sku,
           line_status = 'substituted'
     where id = p_item_id;
  else
    raise exception 'Unknown action %', p_action;
  end if;

  return p_item_id;
end;
$$;

revoke execute on function public.resolve_online_order_line(uuid, text, uuid) from anon, public;
grant execute on function public.resolve_online_order_line(uuid, text, uuid) to authenticated;
