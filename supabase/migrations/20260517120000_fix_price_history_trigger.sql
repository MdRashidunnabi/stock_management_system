-- =============================================================================
-- ShopOS - Step 7 - Fix product price history trigger
-- =============================================================================
-- The product_price_history table has only a SELECT RLS policy (it's a
-- write-once audit table). Inserts come exclusively from the
-- app.record_product_price_change() trigger which runs as the calling user
-- (a tenant member). Without SECURITY DEFINER, the trigger's INSERT was
-- blocked by RLS the first time a user updated a product's price.
--
-- Switch the trigger function to SECURITY DEFINER so it can write to the
-- audit table while still preserving RLS for direct user writes (which we
-- never want to allow on this table).

create or replace function app.record_product_price_change() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.selling_price is distinct from old.selling_price) then
    insert into public.product_price_history (tenant_id, product_id, field, old_value, new_value, changed_by)
    values (new.tenant_id, new.id, 'selling_price', old.selling_price, new.selling_price, new.updated_by);
  end if;
  if (new.purchase_price is distinct from old.purchase_price) then
    insert into public.product_price_history (tenant_id, product_id, field, old_value, new_value, changed_by)
    values (new.tenant_id, new.id, 'purchase_price', old.purchase_price, new.purchase_price, new.updated_by);
  end if;
  return new;
end;
$$;

-- Restrict who can call the function directly (only the trigger should).
revoke execute on function app.record_product_price_change() from public;
