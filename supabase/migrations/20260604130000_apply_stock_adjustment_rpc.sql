-- Manual stock correction: set available quantity or apply a +/- delta at a branch.

create or replace function public.apply_stock_adjustment(
  p_branch_id      uuid,
  p_product_id     uuid,
  p_reason         text,
  p_delta          numeric default null,
  p_new_quantity   numeric default null
) returns table (
  adjustment_id uuid,
  previous_qty  numeric,
  new_qty       numeric
)
language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id      uuid := auth.uid();
  v_tenant_id    uuid;
  v_current      numeric(14,4) := 0;
  v_delta        numeric(14,4);
  v_ledger_id    bigint;
  v_adj_id       uuid := gen_random_uuid();
  v_unit_cost    numeric(14,4);
begin
  if v_user_id is null then
    raise exception 'apply_stock_adjustment: must be authenticated' using errcode = '42501';
  end if;

  if p_reason is null or length(trim(p_reason)) < 3 then
    raise exception 'apply_stock_adjustment: reason is required (min 3 characters)' using errcode = '22023';
  end if;

  select tenant_id into v_tenant_id
    from public.branches where id = p_branch_id;
  if v_tenant_id is null then
    raise exception 'apply_stock_adjustment: branch not found' using errcode = '23503';
  end if;

  if not app.has_tenant_role(v_tenant_id, array['owner','manager','warehouse']::text[])
     and not app.is_super_admin() then
    raise exception 'apply_stock_adjustment: not allowed for this role' using errcode = '42501';
  end if;

  perform 1 from public.products
   where id = p_product_id and tenant_id = v_tenant_id;
  if not found then
    raise exception 'apply_stock_adjustment: product not found' using errcode = '23503';
  end if;

  select coalesce(quantity, 0) into v_current
    from public.stock_balances
   where tenant_id = v_tenant_id
     and branch_id = p_branch_id
     and product_id = p_product_id
     and variant_id is null
     and state = 'available';

  if p_new_quantity is not null then
    if p_new_quantity < 0 then
      raise exception 'apply_stock_adjustment: new quantity cannot be negative' using errcode = '22023';
    end if;
    v_delta := round(p_new_quantity - coalesce(v_current, 0), 4);
  elsif p_delta is not null then
    v_delta := round(p_delta, 4);
  else
    raise exception 'apply_stock_adjustment: provide delta or new_quantity' using errcode = '22023';
  end if;

  if v_delta = 0 then
    return query select v_adj_id, coalesce(v_current, 0), coalesce(v_current, 0);
    return;
  end if;

  select purchase_price into v_unit_cost
    from public.products where id = p_product_id;

  insert into public.stock_adjustments (
    id, tenant_id, branch_id, product_id, variant_id, state,
    delta, reason, status, requested_by, approved_by, approved_at
  ) values (
    v_adj_id, v_tenant_id, p_branch_id, p_product_id, null, 'available',
    v_delta, trim(p_reason), 'approved', v_user_id, v_user_id, now()
  );

  if v_delta > 0 then
    v_ledger_id := app.apply_stock_movement(
      v_tenant_id, p_branch_id, p_product_id, null, null,
      'count_correction', null, 'available'::public.stock_state,
      v_delta, v_unit_cost,
      'adjustment', v_adj_id, v_user_id, trim(p_reason)
    );
  else
    if coalesce(v_current, 0) + v_delta < 0 then
      raise exception 'apply_stock_adjustment: cannot reduce below zero (on hand %, delta %)',
        coalesce(v_current, 0), v_delta using errcode = '22023';
    end if;
    v_ledger_id := app.apply_stock_movement(
      v_tenant_id, p_branch_id, p_product_id, null, null,
      'count_correction', 'available'::public.stock_state, null,
      abs(v_delta), v_unit_cost,
      'adjustment', v_adj_id, v_user_id, trim(p_reason)
    );
  end if;

  update public.stock_adjustments
     set applied_ledger_id = v_ledger_id
   where id = v_adj_id;

  select coalesce(quantity, 0) into v_current
    from public.stock_balances
   where tenant_id = v_tenant_id
     and branch_id = p_branch_id
     and product_id = p_product_id
     and variant_id is null
     and state = 'available';

  return query select v_adj_id, coalesce(v_current, 0) - v_delta, v_current;
end;
$$;

revoke execute on function public.apply_stock_adjustment(uuid, uuid, text, numeric, numeric) from anon, public;
grant execute on function public.apply_stock_adjustment(uuid, uuid, text, numeric, numeric) to authenticated;
