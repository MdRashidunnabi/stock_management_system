-- add_branch_for_tenant used search_path = '' and called
-- app.has_tenant_role(..., public.user_role[]). That helper takes text[],
-- so Postgres 17 raised 42883 and extra branches never attached to a shop.

create or replace function public.add_branch_for_tenant(
  p_tenant_id uuid,
  p_code text,
  p_name text,
  p_address_line1 text default null,
  p_city text default null,
  p_county text default null,
  p_eircode text default null
)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid := auth.uid();
  v_branch_id uuid;
  v_count int;
  v_limit int;
  v_billing_id uuid;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not app.has_tenant_role(p_tenant_id, array['owner', 'manager']::text[]) then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  select t.billing_account_id into v_billing_id from public.tenants t where t.id = p_tenant_id;
  select coalesce(ba.licensed_branch_count, 1) into v_limit
  from public.billing_accounts ba
  where ba.id = v_billing_id;

  select count(*)::int into v_count from public.branches b where b.tenant_id = p_tenant_id and b.is_active;

  if v_count >= v_limit then
    raise exception 'branch limit reached (%). Upgrade your plan.', v_limit using errcode = '42501';
  end if;

  insert into public.branches (
    tenant_id, code, name, address_line1, city, county, eircode, is_active, created_by, updated_by
  ) values (
    p_tenant_id,
    upper(trim(p_code)),
    trim(p_name),
    nullif(trim(coalesce(p_address_line1, '')), ''),
    nullif(trim(coalesce(p_city, '')), ''),
    nullif(trim(coalesce(p_county, '')), ''),
    nullif(trim(coalesce(p_eircode, '')), ''),
    true,
    v_user_id, v_user_id
  )
  returning id into v_branch_id;

  return v_branch_id;
end;
$$;

grant execute on function public.add_branch_for_tenant(uuid, text, text, text, text, text, text) to authenticated;
