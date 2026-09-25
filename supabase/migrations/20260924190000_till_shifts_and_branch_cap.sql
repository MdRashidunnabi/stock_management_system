-- =============================================================================
-- Tills per branch (max 10), shift codes, per-till close, shift-wide accounts
-- =============================================================================
--
-- A branch may register at most 10 tills. Sales and payments stay on the
-- pos_session for that till. Closing a session is the till's own cash-up;
-- the same till can then open for another shift (morning / evening / night).
-- Final accounting reads every till session for that branch + date + shift.
-- =============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'pos_shift_code') then
    create type public.pos_shift_code as enum ('morning', 'evening', 'night');
  end if;
  if not exists (select 1 from pg_type where typname = 'shift_account_status') then
    create type public.shift_account_status as enum ('open', 'finalised');
  end if;
end
$$;

alter table public.pos_devices
  add column if not exists branch_id uuid references public.branches (id) on delete set null;

create index if not exists pos_devices_branch_idx
  on public.pos_devices (tenant_id, branch_id)
  where revoked_at is null;

alter table public.pos_sessions
  add column if not exists shift_code public.pos_shift_code not null default 'morning',
  add column if not exists business_date date not null default (timezone('Europe/Dublin', now()))::date,
  add column if not exists device_id text;

update public.pos_sessions
   set business_date = (opened_at at time zone 'Europe/Dublin')::date
 where business_date is distinct from (opened_at at time zone 'Europe/Dublin')::date;

create index if not exists pos_sessions_shift_idx
  on public.pos_sessions (tenant_id, branch_id, business_date, shift_code);

create unique index if not exists pos_sessions_one_open_per_device
  on public.pos_sessions (tenant_id, device_id)
  where status = 'open' and device_id is not null;

-- Max 10 active tills (devices) per branch -----------------------------------

create or replace function app.assert_branch_till_cap()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_count integer;
begin
  if NEW.revoked_at is not null or NEW.branch_id is null then
    return NEW;
  end if;

  select count(*)::integer into v_count
    from public.pos_devices
   where tenant_id = NEW.tenant_id
     and branch_id = NEW.branch_id
     and revoked_at is null
     and id is distinct from NEW.id;

  if v_count >= 10 then
    raise exception 'This branch already has 10 tills. Revoke one in Settings before adding another.'
      using errcode = 'P0001';
  end if;

  return NEW;
end;
$$;

drop trigger if exists pos_devices_branch_till_cap on public.pos_devices;
create trigger pos_devices_branch_till_cap
  before insert or update of branch_id, revoked_at
  on public.pos_devices
  for each row execute function app.assert_branch_till_cap();

-- Shift-wide final account (can be saved at any time) ------------------------

create table if not exists public.shift_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  branch_id uuid not null references public.branches (id) on delete cascade,
  business_date date not null,
  shift_code public.pos_shift_code not null,
  status public.shift_account_status not null default 'open',
  notes text,
  totals jsonb not null default '{}'::jsonb,
  finalised_at timestamptz,
  finalised_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, branch_id, business_date, shift_code)
);

create index if not exists shift_accounts_branch_idx
  on public.shift_accounts (tenant_id, branch_id, business_date);

alter table public.shift_accounts enable row level security;

drop policy if exists shift_accounts_member_select on public.shift_accounts;
create policy shift_accounts_member_select on public.shift_accounts
  for select using (
    tenant_id in (select app.current_user_tenant_ids())
    or app.is_super_admin()
  );

drop policy if exists shift_accounts_staff_write on public.shift_accounts;
create policy shift_accounts_staff_write on public.shift_accounts
  for all using (
    app.has_tenant_role(tenant_id, array['owner', 'manager', 'accountant']::text[])
    or app.is_super_admin()
  )
  with check (
    app.has_tenant_role(tenant_id, array['owner', 'manager', 'accountant']::text[])
    or app.is_super_admin()
  );

grant select, insert, update on public.shift_accounts to authenticated;

drop trigger if exists shift_accounts_set_updated_at on public.shift_accounts;
create trigger shift_accounts_set_updated_at
  before update on public.shift_accounts
  for each row execute function app.set_updated_at();

-- Keep auto-open sessions inside the 10-till cap -----------------------------

create or replace function app.ensure_open_pos_session(
  p_tenant_id   uuid,
  p_branch_id   uuid,
  p_terminal_id uuid,
  p_cashier_id  uuid
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_session_id uuid;
  v_open_count integer;
begin
  select id into v_session_id
    from public.pos_sessions
   where tenant_id = p_tenant_id
     and branch_id = p_branch_id
     and cashier_id = p_cashier_id
     and status = 'open'
   order by opened_at desc
   limit 1;

  if v_session_id is not null then
    return v_session_id;
  end if;

  select count(*)::integer into v_open_count
    from public.pos_sessions
   where tenant_id = p_tenant_id
     and branch_id = p_branch_id
     and status = 'open';

  if v_open_count >= 10 then
    raise exception 'This branch already has 10 tills open. Close one before opening another.'
      using errcode = 'P0001';
  end if;

  insert into public.pos_sessions (
    tenant_id, branch_id, terminal_id, cashier_id, status, opening_cash,
    shift_code, business_date
  ) values (
    p_tenant_id, p_branch_id, p_terminal_id, p_cashier_id, 'open', 0,
    'morning', (timezone('Europe/Dublin', now()))::date
  ) returning id into v_session_id;

  return v_session_id;
end;
$$;

revoke execute on function app.ensure_open_pos_session(uuid, uuid, uuid, uuid) from public;

-- Open till: shift + business date + device, max 10 open per branch ----------

drop function if exists public.open_pos_session(uuid, numeric, uuid, text);

create or replace function public.open_pos_session(
  p_branch_id      uuid,
  p_opening_cash   numeric default 0,
  p_terminal_id    uuid default null,
  p_note           text default null,
  p_shift_code     public.pos_shift_code default 'morning',
  p_business_date  date default (timezone('Europe/Dublin', now()))::date,
  p_device_id      text default null
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id     uuid := auth.uid();
  v_tenant_id   uuid;
  v_existing    uuid;
  v_session_id  uuid;
  v_clean_note  text;
  v_device      text;
  v_open_count  integer;
  v_till_count  integer;
  v_revoked     timestamptz;
begin
  if v_user_id is null then
    raise exception 'open_pos_session: must be authenticated' using errcode = '42501';
  end if;

  if p_opening_cash is null or p_opening_cash < 0 then
    raise exception 'open_pos_session: opening_cash must be >= 0';
  end if;

  if p_business_date is null then
    raise exception 'open_pos_session: business_date is required';
  end if;

  select tenant_id into v_tenant_id from public.branches where id = p_branch_id;
  if v_tenant_id is null then
    raise exception 'open_pos_session: branch not found' using errcode = '23503';
  end if;

  if not app.has_tenant_role(v_tenant_id, array['owner','manager','cashier','warehouse']::text[])
     and not app.is_super_admin() then
    raise exception 'open_pos_session: not a staff member of this tenant' using errcode = '42501';
  end if;

  select id into v_existing
    from public.pos_sessions
   where tenant_id = v_tenant_id
     and branch_id = p_branch_id
     and cashier_id = v_user_id
     and status = 'open'
   limit 1;

  if v_existing is not null then
    raise exception 'open_pos_session: you already have an open till on this branch (id=%); close it before opening a new one', v_existing
      using errcode = '23505';
  end if;

  select count(*)::integer into v_open_count
    from public.pos_sessions
   where tenant_id = v_tenant_id
     and branch_id = p_branch_id
     and status = 'open';

  if v_open_count >= 10 then
    raise exception 'This branch already has 10 tills open. Close one before opening another.'
      using errcode = 'P0001';
  end if;

  v_device := nullif(trim(coalesce(p_device_id, '')), '');

  if v_device is not null then
    select id into v_existing
      from public.pos_sessions
     where tenant_id = v_tenant_id
       and device_id = v_device
       and status = 'open'
     limit 1;

    if v_existing is not null then
      raise exception 'This till computer already has an open session. Close it before opening another.'
        using errcode = '23505';
    end if;

    select revoked_at into v_revoked
      from public.pos_devices
     where tenant_id = v_tenant_id
       and device_id = v_device;

    if v_revoked is not null then
      raise exception 'This till was revoked. Ask the shop owner to restore it.' using errcode = '42501';
    end if;

    select count(*)::integer into v_till_count
      from public.pos_devices
     where tenant_id = v_tenant_id
       and branch_id = p_branch_id
       and revoked_at is null
       and device_id is distinct from v_device;

    if not exists (
      select 1 from public.pos_devices
       where tenant_id = v_tenant_id
         and device_id = v_device
         and branch_id = p_branch_id
         and revoked_at is null
    ) and v_till_count >= 10 then
      raise exception 'This branch already has 10 tills. Revoke one in Settings before adding another.'
        using errcode = 'P0001';
    end if;

    insert into public.pos_devices (tenant_id, device_id, branch_id, label, last_heartbeat_at)
    values (v_tenant_id, v_device, p_branch_id, 'Till', now())
    on conflict (tenant_id, device_id) do update
      set branch_id = excluded.branch_id,
          last_heartbeat_at = now()
    where public.pos_devices.revoked_at is null;
  end if;

  insert into public.pos_sessions (
    tenant_id, branch_id, terminal_id, cashier_id, status, opening_cash,
    opened_at, shift_code, business_date, device_id
  ) values (
    v_tenant_id, p_branch_id, p_terminal_id, v_user_id, 'open', p_opening_cash,
    now(), coalesce(p_shift_code, 'morning'), p_business_date, v_device
  ) returning id into v_session_id;

  v_clean_note := nullif(trim(coalesce(p_note, '')), '');
  insert into public.cash_drawer_movements (
    tenant_id, pos_session_id, type, amount, reason, user_id
  ) values (
    v_tenant_id, v_session_id, 'opening', p_opening_cash,
    coalesce(v_clean_note, 'Opening float'), v_user_id
  );

  return v_session_id;
end;
$$;

revoke execute on function public.open_pos_session(uuid, numeric, uuid, text, public.pos_shift_code, date, text) from anon, public;
grant  execute on function public.open_pos_session(uuid, numeric, uuid, text, public.pos_shift_code, date, text) to authenticated;
