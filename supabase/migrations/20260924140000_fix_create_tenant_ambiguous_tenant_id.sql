-- RETURNS TABLE (tenant_id, branch_id, ...) makes those names PL/pgSQL variables.
-- INSERT / ON CONFLICT (tenant_id) then errors with 42702 on Postgres 17.
-- Keep the public return shape; tell plpgsql to treat those names as table columns.

drop function if exists public.create_tenant_with_owner(
  text, text, text, text, text, text, text, text, text, text, text, text, text, text,
  int, int, int
);

drop function if exists public.create_tenant_with_owner(
  text, text, text, text, text, text, text, text, text, text, text, text, text, text,
  int, int, int, jsonb
);

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
#variable_conflict use_column
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
  on conflict on constraint tenant_storefronts_pkey
  do update set branch_id = excluded.branch_id;

  return query select v_tenant_id, v_branch_id, v_attempt, v_billing_account_id;
end;
$$;

revoke execute on function public.create_tenant_with_owner(
  text, text, text, text, text, text, text, text, text, text, text, text, text, text,
  int, int, int, jsonb
) from public, anon;

grant execute on function public.create_tenant_with_owner(
  text, text, text, text, text, text, text, text, text, text, text, text, text, text,
  int, int, int, jsonb
) to authenticated;
