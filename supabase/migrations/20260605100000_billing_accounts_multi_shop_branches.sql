-- =============================================================================
-- Owner billing accounts (multi-shop tiers), branch limits, multi-shop RPC
-- =============================================================================

create table if not exists public.billing_accounts (
  id                      uuid primary key default gen_random_uuid(),
  owner_user_id           uuid not null references auth.users (id) on delete restrict,
  plan_shop_tier          int not null default 1 check (plan_shop_tier in (1, 5, 10, 15, 20, 25, 30)),
  plan_branch_tier        int not null default 1 check (plan_branch_tier in (1, 5, 10, 15, 20, 25, 30)),
  licensed_shop_count     int not null default 1 check (licensed_shop_count > 0),
  licensed_branch_count   int not null default 1 check (licensed_branch_count > 0),
  monthly_amount_cents    int not null default 2000 check (monthly_amount_cents >= 0),
  currency                text not null default 'EUR',
  provider                text not null default 'demo' check (provider in ('demo', 'stripe')),
  card_on_file            boolean not null default false,
  card_last4              text,
  card_brand              text,
  stripe_customer_id      text,
  stripe_subscription_id  text,
  next_billing_at         timestamptz,
  last_payment_at         timestamptz,
  last_payment_status     text,
  canceled_at             timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (owner_user_id)
);

comment on table public.billing_accounts is
  'One subscription per shop owner. Covers up to licensed_shop_count tenants and branch limits per shop.';

create trigger billing_accounts_set_updated_at
  before update on public.billing_accounts
  for each row execute function app.set_updated_at();

alter table public.tenants
  add column if not exists billing_account_id uuid references public.billing_accounts (id) on delete set null;

create index if not exists tenants_billing_account_idx on public.tenants (billing_account_id);

-- RLS: owners see their billing account
alter table public.billing_accounts enable row level security;

create policy billing_accounts_owner_select on public.billing_accounts
  for select to authenticated
  using (owner_user_id = auth.uid());

create policy billing_accounts_owner_update on public.billing_accounts
  for update to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

create policy billing_accounts_platform_all on public.billing_accounts
  for all to authenticated
  using (app.is_platform_staff())
  with check (app.is_platform_staff());

-- Count active shops under an owner's billing account
create or replace function app.owner_shop_count(p_owner_id uuid)
returns int
language sql stable security definer set search_path = ''
as $$
  select count(*)::int
  from public.tenants t
  join public.billing_accounts ba on ba.id = t.billing_account_id
  where ba.owner_user_id = p_owner_id;
$$;

-- Create or return billing account for owner
create or replace function app.ensure_billing_account(
  p_owner_id uuid,
  p_shop_tier int,
  p_branch_tier int,
  p_monthly_cents int
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  select id into v_id from public.billing_accounts where owner_user_id = p_owner_id;
  if v_id is not null then
    update public.billing_accounts
    set plan_shop_tier = p_shop_tier,
        plan_branch_tier = p_branch_tier,
        licensed_shop_count = p_shop_tier,
        licensed_branch_count = p_branch_tier,
        monthly_amount_cents = p_monthly_cents,
        updated_at = now()
    where id = v_id;
    return v_id;
  end if;

  insert into public.billing_accounts (
    owner_user_id, plan_shop_tier, plan_branch_tier,
    licensed_shop_count, licensed_branch_count, monthly_amount_cents
  ) values (
    p_owner_id, p_shop_tier, p_branch_tier, p_shop_tier, p_branch_tier, p_monthly_cents
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- Replace create_tenant_with_owner: supports first shop + additional shops under license
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
  p_monthly_amount_cents int default 2000
)
returns table (tenant_id uuid, branch_id uuid, slug text, billing_account_id uuid)
language plpgsql security definer set search_path = '' as $$
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
    country, currency, timezone, default_locale,
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
  on conflict (tenant_id) do update set branch_id = excluded.branch_id;

  return query select v_tenant_id, v_branch_id, v_attempt, v_billing_account_id;
end;
$$;

-- Add branch (respect licensed_branch_count per tenant)
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

  if not app.has_tenant_role(p_tenant_id, array['owner', 'manager']::public.user_role[]) then
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

revoke execute on function public.create_tenant_with_owner(
  text, text, text, text, text, text, text, text, text, text, text, text, text, text,
  int, int, int
) from public, anon;
grant execute on function public.create_tenant_with_owner(
  text, text, text, text, text, text, text, text, text, text, text, text, text, text,
  int, int, int
) to authenticated;

-- Backfill billing accounts for existing owners (one account per owner, first tenant's billing)
insert into public.billing_accounts (owner_user_id, plan_shop_tier, plan_branch_tier, licensed_shop_count, licensed_branch_count, monthly_amount_cents, provider, card_on_file, card_last4, card_brand)
select distinct on (ut.user_id)
  ut.user_id,
  1, 1, 1, 1,
  coalesce(tb.monthly_amount_cents, 2000),
  coalesce(tb.provider, 'demo'),
  coalesce(tb.card_on_file, false),
  tb.card_last4,
  tb.card_brand
from public.user_tenants ut
join public.tenants t on t.id = ut.tenant_id
left join public.tenant_billing tb on tb.tenant_id = t.id
where ut.role = 'owner' and ut.is_active = true
  and not exists (select 1 from public.billing_accounts ba where ba.owner_user_id = ut.user_id)
order by ut.user_id, t.created_at;

update public.tenants t
set billing_account_id = sub.ba_id
from (
  select t2.id as tenant_id, ba.id as ba_id
  from public.tenants t2
  inner join public.user_tenants ut
    on ut.tenant_id = t2.id and ut.role = 'owner' and ut.is_active = true
  inner join public.billing_accounts ba on ba.owner_user_id = ut.user_id
) sub
where t.id = sub.tenant_id and t.billing_account_id is null;
