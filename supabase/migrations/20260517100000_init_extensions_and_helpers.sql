-- =============================================================================
-- ShopOS - Step 4 - Migration 01: Extensions, schemas, helper functions
-- =============================================================================

-- Extensions ------------------------------------------------------------------
create extension if not exists pgcrypto;        -- gen_random_uuid()
create extension if not exists "uuid-ossp";     -- legacy uuid_generate_v4
create extension if not exists citext;          -- case-insensitive text (emails, codes)
create extension if not exists pg_trgm;         -- product/customer search
create extension if not exists btree_gin;       -- composite trigram indexes
create extension if not exists unaccent;        -- search ignoring accents

-- Application namespace -------------------------------------------------------
create schema if not exists app;
comment on schema app is 'ShopOS internal helper functions, types, and admin objects.';

-- =============================================================================
-- Helper functions used by RLS and triggers
-- =============================================================================

-- Returns the currently authenticated user, or NULL if anonymous.
create or replace function app.current_user_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select auth.uid();
$$;

-- Returns the tenant ids the current user belongs to.
create or replace function app.current_user_tenant_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select ut.tenant_id
  from public.user_tenants ut
  where ut.user_id = auth.uid()
    and ut.is_active = true;
$$;

-- Returns true if the current user has a given role on a tenant.
-- roles_in: text[] (e.g. ARRAY['owner','manager']).
create or replace function app.has_tenant_role(p_tenant_id uuid, roles_in text[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.user_tenants ut
    where ut.user_id = auth.uid()
      and ut.tenant_id = p_tenant_id
      and ut.is_active = true
      and ut.role = any(roles_in)
  );
$$;

-- Returns true if the current user is a super admin (our company staff).
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

-- Reusable updated_at trigger
create or replace function app.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function app.current_user_id is 'Wraps auth.uid() for stable references.';
comment on function app.current_user_tenant_ids is 'Tenant ids the auth user can access (active rows only).';
comment on function app.has_tenant_role is 'True iff the auth user has any of the given roles on the tenant.';
comment on function app.is_super_admin is 'True iff the auth user is platform staff (super_admin or support_admin).';
comment on function app.set_updated_at is 'Trigger that bumps updated_at to now() on every UPDATE.';
