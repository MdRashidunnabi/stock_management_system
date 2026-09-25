-- Till / desktop devices must check in with ShopOS. A downloaded app without
-- an active paid (or trial) lease cannot keep selling.

create table if not exists public.pos_devices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  device_id text not null,
  label text,
  user_agent text,
  last_heartbeat_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint pos_devices_tenant_device unique (tenant_id, device_id)
);

create index if not exists pos_devices_tenant_idx on public.pos_devices (tenant_id);

alter table public.pos_devices enable row level security;

create policy pos_devices_member_select on public.pos_devices
  for select using (
    tenant_id in (select app.current_user_tenant_ids())
    or app.is_super_admin()
  );

create policy pos_devices_staff_write on public.pos_devices
  for all using (
    app.has_tenant_role(tenant_id, array['owner', 'manager']::text[])
    or app.is_super_admin()
  )
  with check (
    app.has_tenant_role(tenant_id, array['owner', 'manager']::text[])
    or app.is_super_admin()
  );

-- Cashiers may upsert their own till heartbeat (same device_id) but not revoke.
create policy pos_devices_cashier_heartbeat on public.pos_devices
  for insert with check (
    app.has_tenant_role(tenant_id, array['owner', 'manager', 'cashier', 'warehouse']::text[])
  );

create policy pos_devices_cashier_update on public.pos_devices
  for update using (
    app.has_tenant_role(tenant_id, array['owner', 'manager', 'cashier', 'warehouse']::text[])
    and revoked_at is null
  )
  with check (
    app.has_tenant_role(tenant_id, array['owner', 'manager', 'cashier', 'warehouse']::text[])
  );

grant select, insert, update on public.pos_devices to authenticated;
