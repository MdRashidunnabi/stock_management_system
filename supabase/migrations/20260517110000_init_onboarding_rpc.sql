-- =============================================================================
-- ShopOS - Step 6 - Migration: tenant onboarding RPC
-- =============================================================================
-- Exposes a single SECURITY DEFINER function that atomically:
--   1. inserts a new public.tenants row (slug auto-suffixed if needed)
--   2. inserts the first public.branches row for that tenant
--   3. inserts the calling auth user into public.user_tenants as 'owner'
--
-- This bypasses RLS deliberately so a brand-new authenticated user can
-- bootstrap their own tenant without granting them broad INSERT permissions.
-- The function returns the new tenant id, branch id, and final slug.
--
-- The function is in the `public` schema because Supabase only exposes
-- functions in `public` (and `graphql_public`) via PostgREST RPC by default.
-- =============================================================================

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
  p_branch_eircode       text default null
) returns table (tenant_id uuid, branch_id uuid, slug text)
language plpgsql security definer set search_path = '' as $$
declare
  v_user_id   uuid := auth.uid();
  v_tenant_id uuid;
  v_branch_id uuid;
  v_slug      text := lower(trim(coalesce(p_slug, '')));
  v_attempt   text;
  v_counter   int := 0;
  v_branch_name text;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if v_slug is null or length(v_slug) < 2 then
    raise exception 'slug must be at least 2 characters' using errcode = '22023';
  end if;

  -- One-tenant-per-onboarding: refuse if the caller already owns a tenant.
  -- Lets users create extra tenants only via a future "Add another shop" flow.
  if exists (
    select 1
    from public.user_tenants ut
    where ut.user_id = v_user_id
      and ut.is_active = true
  ) then
    raise exception 'caller already belongs to a tenant' using errcode = '42501';
  end if;

  -- Find a unique slug. Tenants.slug is citext so collision check is
  -- case-insensitive. We auto-suffix -1, -2, ... until we find a free one.
  v_attempt := v_slug;
  while exists (select 1 from public.tenants t where t.slug = v_attempt) loop
    v_counter := v_counter + 1;
    if v_counter > 100 then
      raise exception 'could not find a unique slug for %', v_slug;
    end if;
    v_attempt := v_slug || '-' || v_counter::text;
  end loop;

  -- Tenant
  insert into public.tenants (
    slug, legal_name, display_name, vat_number,
    country, currency, timezone, default_locale,
    status, trial_ends_at, created_by, updated_by
  ) values (
    v_attempt,
    trim(p_legal_name),
    trim(p_display_name),
    nullif(trim(coalesce(p_vat_number, '')), ''),
    coalesce(p_country, 'IE'),
    coalesce(p_currency, 'EUR'),
    coalesce(p_timezone, 'Europe/Dublin'),
    coalesce(p_locale, 'en-IE'),
    'trial',
    now() + interval '30 days',
    v_user_id, v_user_id
  )
  returning id into v_tenant_id;

  -- Branch
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

  -- Ownership: caller becomes 'owner'. branch_id stays null so they have
  -- access to every branch under this tenant (per RLS policies in 109000).
  insert into public.user_tenants (
    user_id, tenant_id, role, branch_id, is_active, accepted_at
  ) values (
    v_user_id, v_tenant_id, 'owner', null, true, now()
  );

  return query select v_tenant_id, v_branch_id, v_attempt;
end;
$$;

comment on function public.create_tenant_with_owner is
  'Onboarding wizard: atomically create a tenant, first branch, and owner membership for auth.uid(). Returns (tenant_id, branch_id, slug). Slug is auto-suffixed if it collides.';

-- Lock down execution: anon must NOT be able to call this; only signed-in
-- users (`authenticated` role) can.
revoke execute on function public.create_tenant_with_owner(
  text, text, text, text, text, text, text, text, text, text, text, text, text, text
) from public;
revoke execute on function public.create_tenant_with_owner(
  text, text, text, text, text, text, text, text, text, text, text, text, text, text
) from anon;
grant execute on function public.create_tenant_with_owner(
  text, text, text, text, text, text, text, text, text, text, text, text, text, text
) to authenticated;
