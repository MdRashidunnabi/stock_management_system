-- =============================================================================
-- ShopOS - Step 4 - Migration 03b: Tenant-aware helper functions
-- =============================================================================
--
-- These helpers must be defined AFTER public.user_tenants exists.
--
-- Postgres binds names in `language sql` functions at CREATE FUNCTION time
-- (not at call time), so referencing a missing table here would fail.
-- That is why these were split out of the first extensions migration.
--
-- Used by:
--   - All RLS policies (see 20260517109000_init_rls.sql)
--   - SECURITY DEFINER server-side procedures
-- =============================================================================

-- Returns the tenant ids the current user belongs to.
create or replace function app.current_user_tenant_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select ut.tenant_id
  from public.user_tenants ut
  where ut.user_id = auth.uid()
    and ut.is_active = true;
$$;

-- Returns true if the current user has any of the given roles on a tenant.
-- roles_in: text[] (e.g. ARRAY['owner','manager']).
create or replace function app.has_tenant_role(p_tenant_id uuid, roles_in text[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.user_tenants ut
    where ut.user_id = auth.uid()
      and ut.tenant_id = p_tenant_id
      and ut.is_active = true
      and ut.role::text = any(roles_in)
  );
$$;

-- Returns true if the current user is platform staff (our company).
create or replace function app.is_super_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.user_tenants ut
    where ut.user_id = auth.uid()
      and ut.is_active = true
      and ut.role in ('super_admin', 'support_admin')
  );
$$;

comment on function app.current_user_tenant_ids
  is 'Tenant ids the auth user can access (active memberships only).';
comment on function app.has_tenant_role
  is 'True iff the auth user has any of the given roles on the tenant.';
comment on function app.is_super_admin
  is 'True iff the auth user is platform staff (super_admin or support_admin).';
