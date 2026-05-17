-- =============================================================================
-- ShopOS - Step 4 - Migration 03: Tenants, branches, profiles, user_tenants
-- =============================================================================

-- Tenants ---------------------------------------------------------------------
create table public.tenants (
  id              uuid primary key default gen_random_uuid(),
  slug            citext not null unique,
  legal_name      text not null,
  display_name    text not null,
  vat_number      text,
  country         text not null default 'IE',
  currency        text not null default 'EUR',
  timezone        text not null default 'Europe/Dublin',
  default_locale  text not null default 'en-IE',
  status          public.tenant_status not null default 'trial',
  trial_ends_at   timestamptz,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id) on delete set null,
  updated_by      uuid references auth.users(id) on delete set null
);

create index tenants_status_idx on public.tenants (status);
create index tenants_country_idx on public.tenants (country);

create trigger tenants_set_updated_at
  before update on public.tenants
  for each row execute function app.set_updated_at();

comment on table public.tenants is 'Each row is a paying customer (one shop or shop group).';

-- Branches --------------------------------------------------------------------
create table public.branches (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  code          text not null,
  name          text not null,
  is_warehouse  boolean not null default false,
  is_active     boolean not null default true,
  address_line1 text,
  address_line2 text,
  city          text,
  county        text,
  eircode       text,
  country       text not null default 'IE',
  phone         text,
  email         citext,
  timezone      text not null default 'Europe/Dublin',
  opening_hours jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id) on delete set null,
  updated_by    uuid references auth.users(id) on delete set null,
  unique (tenant_id, code)
);

create index branches_tenant_idx on public.branches (tenant_id);
create index branches_active_idx on public.branches (tenant_id, is_active);

create trigger branches_set_updated_at
  before update on public.branches
  for each row execute function app.set_updated_at();

comment on table public.branches is 'Physical locations under a tenant (a warehouse is a branch with is_warehouse=true).';

-- Profiles (extends auth.users) -----------------------------------------------
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         citext not null,
  full_name     text,
  phone         text,
  avatar_url    text,
  locale        text not null default 'en-IE',
  is_platform_staff boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index profiles_email_idx on public.profiles (email);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function app.set_updated_at();

comment on table public.profiles is 'Public profile data for auth.users (1:1).';

-- Auto-create profile when a Supabase auth user is inserted.
-- SECURITY DEFINER + row_security off so the insert bypasses RLS on profiles.
create or replace function app.handle_new_auth_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  set local row_security = off;
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(public.profiles.full_name, excluded.full_name);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app.handle_new_auth_user();

-- user_tenants (membership + role per tenant) ---------------------------------
create table public.user_tenants (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  role         public.user_role not null,
  branch_id    uuid references public.branches(id) on delete set null,  -- optional scope
  is_active    boolean not null default true,
  invited_by   uuid references auth.users(id) on delete set null,
  invited_at   timestamptz,
  accepted_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, tenant_id, role, branch_id)
);

create index user_tenants_user_idx on public.user_tenants (user_id);
create index user_tenants_tenant_idx on public.user_tenants (tenant_id);
create index user_tenants_active_idx on public.user_tenants (user_id, is_active);

create trigger user_tenants_set_updated_at
  before update on public.user_tenants
  for each row execute function app.set_updated_at();

comment on table public.user_tenants is 'Maps an auth.users to a tenant with a role; a user can belong to many tenants.';

-- Indexes used by RLS predicates
create index branches_tenant_lookup on public.branches (tenant_id, id);
