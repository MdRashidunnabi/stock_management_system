-- =============================================================================
-- ShopOS - Step 4 - Migration 01: Extensions, app schema, table-independent helpers
-- =============================================================================
--
-- This migration must NOT reference any public.* table because none exist yet.
-- Helpers that need public.user_tenants live in 20260517100250_*.sql, which
-- runs AFTER 20260517100200_init_tenants_and_users.sql.
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
-- Table-independent helpers (safe to define before any public.* table exists)
-- =============================================================================

-- Returns the currently authenticated user, or NULL if anonymous.
-- Only references auth.uid() (provided by the Supabase auth schema, which
-- exists at migration time).
create or replace function app.current_user_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select auth.uid();
$$;

-- Reusable updated_at trigger - no table references in its body.
create or replace function app.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function app.current_user_id is 'Wraps auth.uid() for stable references.';
comment on function app.set_updated_at is 'Trigger that bumps updated_at to now() on every UPDATE.';
