-- SaaS billing (demo provider now, Stripe-ready columns), team invites, platform helpers

-- ---------------------------------------------------------------------------
-- Billing per tenant (demo card + future Stripe IDs)
-- ---------------------------------------------------------------------------
create table if not exists public.tenant_billing (
  tenant_id uuid primary key references public.tenants (id) on delete cascade,
  provider text not null default 'demo' check (provider in ('demo', 'stripe')),
  plan_code text not null default 'standard',
  monthly_amount_cents integer not null default 2000,
  currency text not null default 'EUR',
  card_on_file boolean not null default false,
  card_last4 text,
  card_brand text,
  stripe_customer_id text,
  stripe_subscription_id text,
  next_billing_at timestamptz,
  last_payment_at timestamptz,
  last_payment_status text,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.tenant_billing is
  'Subscription billing. provider=demo for trials without Stripe; stripe when STRIPE_* env is configured.';

create trigger tenant_billing_set_updated_at
  before update on public.tenant_billing
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- Staff invites (owner shares link; no email provider required for demo)
-- ---------------------------------------------------------------------------
create table if not exists public.tenant_invites (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  email text not null,
  role public.user_role not null,
  branch_id uuid references public.branches (id) on delete set null,
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  invited_by uuid references auth.users (id) on delete set null,
  invited_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  revoked_at timestamptz,
  constraint tenant_invites_role_staff check (
    role in ('manager', 'cashier', 'accountant', 'warehouse', 'delivery')
  )
);

create index tenant_invites_tenant_idx on public.tenant_invites (tenant_id);
create index tenant_invites_email_idx on public.tenant_invites (lower(email));
create index tenant_invites_token_idx on public.tenant_invites (token);

-- ---------------------------------------------------------------------------
-- Access helpers (used by app + optional RPC guards)
-- ---------------------------------------------------------------------------
create or replace function app.is_platform_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_platform_staff = true
  )
  or exists (
    select 1
    from public.user_tenants ut
    where ut.user_id = auth.uid()
      and ut.is_active = true
      and ut.role in ('super_admin', 'support_admin')
  );
$$;

create or replace function app.tenant_has_app_access(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tenants t
    where t.id = p_tenant_id
      and (
        app.is_platform_staff()
        or (
          t.status in ('trial', 'active', 'past_due')
          and (
            t.status <> 'trial'
            or t.trial_ends_at is null
            or t.trial_ends_at > now()
          )
        )
      )
  );
$$;

-- Backfill billing rows for existing tenants
insert into public.tenant_billing (tenant_id, card_on_file, next_billing_at)
select t.id, false, coalesce(t.trial_ends_at, now() + interval '30 days')
from public.tenants t
on conflict (tenant_id) do nothing;

-- Demo tenants with active trial get card_on_file for smoother demos
update public.tenant_billing tb
set card_on_file = true,
    card_last4 = '4242',
    card_brand = 'visa'
from public.tenants t
where tb.tenant_id = t.id
  and t.status in ('trial', 'active');

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.tenant_billing enable row level security;
alter table public.tenant_invites enable row level security;

create policy tenant_billing_member_select on public.tenant_billing
  for select using (
    tenant_id in (select app.current_user_tenant_ids())
    or app.is_platform_staff()
  );

create policy tenant_billing_owner_manage on public.tenant_billing
  for all using (
    app.has_tenant_role(tenant_id, array['owner']::text[])
    or app.is_platform_staff()
  )
  with check (
    app.has_tenant_role(tenant_id, array['owner']::text[])
    or app.is_platform_staff()
  );

create policy tenant_invites_member_select on public.tenant_invites
  for select using (
    tenant_id in (select app.current_user_tenant_ids())
    or app.is_platform_staff()
  );

create policy tenant_invites_admin_write on public.tenant_invites
  for insert with check (
    app.has_tenant_role(tenant_id, array['owner', 'manager']::text[])
    or app.is_platform_staff()
  );

create policy tenant_invites_admin_update on public.tenant_invites
  for update using (
    app.has_tenant_role(tenant_id, array['owner', 'manager']::text[])
    or app.is_platform_staff()
  );

drop policy if exists tenants_platform_update on public.tenants;
create policy tenants_platform_update on public.tenants
  for update using (app.is_platform_staff());

drop policy if exists profiles_platform_staff on public.profiles;
create policy profiles_platform_staff on public.profiles
  for update using (app.is_platform_staff());

-- ---------------------------------------------------------------------------
-- Accept invite (SECURITY DEFINER)
-- ---------------------------------------------------------------------------
create or replace function public.accept_tenant_invite(p_token text)
returns table (tenant_id uuid, role text, tenant_slug text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_invite public.tenant_invites%rowtype;
  v_slug text;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select * into v_invite
  from public.tenant_invites i
  where i.token = trim(p_token)
    and i.revoked_at is null
    and i.accepted_at is null
    and i.expires_at > now()
  for update;

  if not found then
    raise exception 'invite not found or expired' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.user_tenants ut
    where ut.user_id = v_user_id and ut.tenant_id = v_invite.tenant_id and ut.is_active = true
  ) then
    raise exception 'you already belong to this shop' using errcode = '42501';
  end if;

  insert into public.user_tenants (
    user_id, tenant_id, role, branch_id, is_active, invited_by, invited_at, accepted_at
  ) values (
    v_user_id, v_invite.tenant_id, v_invite.role, v_invite.branch_id, true,
    v_invite.invited_by, v_invite.invited_at, now()
  )
  on conflict do nothing;

  update public.tenant_invites
  set accepted_at = now(), accepted_by = v_user_id
  where id = v_invite.id;

  select t.slug into v_slug from public.tenants t where t.id = v_invite.tenant_id;

  return query select v_invite.tenant_id, v_invite.role::text, v_slug;
end;
$$;

grant execute on function public.accept_tenant_invite(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Provision billing row when tenant is created (extend RPC in app migration patch)
-- ---------------------------------------------------------------------------
create or replace function public.ensure_tenant_billing_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.tenant_billing (tenant_id, next_billing_at)
  values (new.id, coalesce(new.trial_ends_at, now() + interval '30 days'))
  on conflict (tenant_id) do nothing;
  return new;
end;
$$;

drop trigger if exists tenants_ensure_billing on public.tenants;
create trigger tenants_ensure_billing
  after insert on public.tenants
  for each row execute function public.ensure_tenant_billing_row();
