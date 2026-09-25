-- Numbered tills per branch: Till 1 … Till 10.
-- A computer keeps its number. Cashiers pick a free number the first time.

alter table public.pos_devices
  add column if not exists till_number integer;

alter table public.pos_sessions
  add column if not exists till_number integer;

alter table public.pos_devices
  drop constraint if exists pos_devices_till_number_range;
alter table public.pos_devices
  add constraint pos_devices_till_number_range
  check (till_number is null or (till_number >= 1 and till_number <= 10));

alter table public.pos_sessions
  drop constraint if exists pos_sessions_till_number_range;
alter table public.pos_sessions
  add constraint pos_sessions_till_number_range
  check (till_number is null or (till_number >= 1 and till_number <= 10));

create unique index if not exists pos_devices_branch_till_number_uq
  on public.pos_devices (tenant_id, branch_id, till_number)
  where revoked_at is null
    and branch_id is not null
    and till_number is not null;

-- Give existing active devices the next free number on their branch.
with ranked as (
  select
    id,
    row_number() over (
      partition by tenant_id, branch_id
      order by created_at, id
    ) as n
  from public.pos_devices
  where revoked_at is null
    and till_number is null
    and branch_id is not null
)
update public.pos_devices d
   set till_number = ranked.n,
       label = 'Till ' || ranked.n
  from ranked
 where d.id = ranked.id
   and ranked.n between 1 and 10;

update public.pos_sessions s
   set till_number = d.till_number
  from public.pos_devices d
 where s.till_number is null
   and s.device_id is not null
   and d.device_id = s.device_id
   and d.tenant_id = s.tenant_id
   and d.till_number is not null;

update public.pos_sessions
   set till_number = 1
 where till_number is null;

update public.pos_devices
   set till_number = 1,
       label = 'Till 1'
 where till_number is null
   and revoked_at is null;

update public.pos_devices
   set label = 'Till ' || till_number
 where till_number is not null
   and (label is null or label = 'Till');

drop function if exists public.open_pos_session(uuid, numeric, uuid, text, public.pos_shift_code, date, text);

create or replace function public.open_pos_session(
  p_branch_id      uuid,
  p_opening_cash   numeric default 0,
  p_terminal_id    uuid default null,
  p_note           text default null,
  p_shift_code     public.pos_shift_code default 'morning',
  p_business_date  date default (timezone('Europe/Dublin', now()))::date,
  p_device_id      text default null,
  p_till_number    integer default null
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id      uuid := auth.uid();
  v_tenant_id    uuid;
  v_existing     uuid;
  v_session_id   uuid;
  v_clean_note   text;
  v_device       text;
  v_open_count   integer;
  v_till_count   integer;
  v_revoked      timestamptz;
  v_till_number  integer;
  v_assigned     integer;
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

  if p_till_number is not null and (p_till_number < 1 or p_till_number > 10) then
    raise exception 'open_pos_session: till number must be between 1 and 10';
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
  v_till_number := p_till_number;

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

    select revoked_at, till_number into v_revoked, v_assigned
      from public.pos_devices
     where tenant_id = v_tenant_id
       and device_id = v_device;

    if v_revoked is not null then
      raise exception 'This till was revoked. Ask the shop owner to restore it.' using errcode = '42501';
    end if;

    if v_assigned is not null then
      v_till_number := v_assigned;
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
  end if;

  if v_till_number is null then
    select gs.n into v_till_number
      from generate_series(1, 10) as gs(n)
     where not exists (
       select 1 from public.pos_devices d
        where d.tenant_id = v_tenant_id
          and d.branch_id = p_branch_id
          and d.revoked_at is null
          and d.till_number = gs.n
          and (v_device is null or d.device_id is distinct from v_device)
     )
     order by gs.n
     limit 1;
  end if;

  if v_till_number is null then
    raise exception 'This branch already has 10 tills. Revoke one in Settings before adding another.'
      using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.pos_devices d
     where d.tenant_id = v_tenant_id
       and d.branch_id = p_branch_id
       and d.revoked_at is null
       and d.till_number = v_till_number
       and (v_device is null or d.device_id is distinct from v_device)
  ) then
    raise exception 'Till % is already this branch. Pick another number.', v_till_number
      using errcode = '23505';
  end if;

  if v_device is not null then
    insert into public.pos_devices (
      tenant_id, device_id, branch_id, label, last_heartbeat_at, till_number
    ) values (
      v_tenant_id, v_device, p_branch_id, 'Till ' || v_till_number, now(), v_till_number
    )
    on conflict (tenant_id, device_id) do update
      set branch_id = excluded.branch_id,
          last_heartbeat_at = now(),
          till_number = coalesce(public.pos_devices.till_number, excluded.till_number),
          label = 'Till ' || coalesce(public.pos_devices.till_number, excluded.till_number)
    where public.pos_devices.revoked_at is null;
  end if;

  insert into public.pos_sessions (
    tenant_id, branch_id, terminal_id, cashier_id, status, opening_cash,
    opened_at, shift_code, business_date, device_id, till_number
  ) values (
    v_tenant_id, p_branch_id, p_terminal_id, v_user_id, 'open', p_opening_cash,
    now(), coalesce(p_shift_code, 'morning'), p_business_date, v_device, v_till_number
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

revoke execute on function public.open_pos_session(uuid, numeric, uuid, text, public.pos_shift_code, date, text, integer) from anon, public;
grant  execute on function public.open_pos_session(uuid, numeric, uuid, text, public.pos_shift_code, date, text, integer) to authenticated;
