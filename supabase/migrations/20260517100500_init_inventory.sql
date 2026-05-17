-- =============================================================================
-- ShopOS - Step 4 - Migration 06: Stock ledger + balances + adjustments
-- =============================================================================
--
-- Design summary:
-- - stock_ledger is APPEND-ONLY. Corrections are compensating rows.
-- - stock_balances is a derived snapshot, kept in sync transactionally
--   with ledger inserts (but always rebuildable from the ledger as truth).
-- =============================================================================

-- Stock ledger (immutable) ----------------------------------------------------
create table public.stock_ledger (
  id                 bigserial primary key,
  tenant_id          uuid not null references public.tenants(id) on delete cascade,
  branch_id          uuid not null references public.branches(id) on delete restrict,

  product_id         uuid not null references public.products(id) on delete restrict,
  variant_id         uuid references public.product_variants(id) on delete set null,
  batch_id           uuid references public.batches(id) on delete set null,

  movement_type      public.stock_movement_type not null,
  from_state         public.stock_state,
  to_state           public.stock_state,
  quantity           numeric(14,4) not null,            -- positive number; direction encoded by from/to states
  unit_cost          numeric(14,4),                     -- cost at time of movement (for COGS)

  reference_type     text,                              -- 'sale','goods_receipt','adjustment','transfer','return','online_order'
  reference_id       uuid,
  related_movement_id bigint references public.stock_ledger(id) on delete set null,

  note               text,
  user_id            uuid references auth.users(id) on delete set null,
  created_at         timestamptz not null default now()
);

create index stock_ledger_tenant_idx on public.stock_ledger (tenant_id);
create index stock_ledger_product_idx on public.stock_ledger (tenant_id, product_id, branch_id, created_at desc);
create index stock_ledger_branch_idx on public.stock_ledger (branch_id, created_at desc);
create index stock_ledger_reference_idx on public.stock_ledger (reference_type, reference_id);
create index stock_ledger_movement_type_idx on public.stock_ledger (tenant_id, movement_type, created_at desc);

-- Block updates and deletes (append-only)
create or replace function app.block_ledger_modifications() returns trigger
language plpgsql as $$
begin
  raise exception 'stock_ledger is append-only; use compensating rows for corrections';
end;
$$;

create trigger stock_ledger_no_update
  before update on public.stock_ledger
  for each row execute function app.block_ledger_modifications();

create trigger stock_ledger_no_delete
  before delete on public.stock_ledger
  for each row execute function app.block_ledger_modifications();

comment on table public.stock_ledger is 'Append-only journal of every stock movement.';

-- Stock balances (derived) ----------------------------------------------------
create table public.stock_balances (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  branch_id     uuid not null references public.branches(id) on delete cascade,
  product_id    uuid not null references public.products(id) on delete cascade,
  variant_id    uuid references public.product_variants(id) on delete cascade,
  state         public.stock_state not null,
  quantity      numeric(14,4) not null default 0,
  updated_at    timestamptz not null default now(),
  unique (tenant_id, branch_id, product_id, variant_id, state)
);

create index stock_balances_tenant_idx on public.stock_balances (tenant_id);
create index stock_balances_lookup_idx on public.stock_balances (tenant_id, product_id, branch_id, state);
create index stock_balances_low_stock_idx on public.stock_balances (tenant_id, branch_id, product_id) where state = 'available';

create trigger stock_balances_set_updated_at
  before update on public.stock_balances
  for each row execute function app.set_updated_at();

comment on table public.stock_balances is 'Per (tenant, branch, product, variant, state) running quantity. Rebuildable from stock_ledger.';

-- =============================================================================
-- Stock movement RPCs
-- =============================================================================
--
-- Use these RPCs from server actions to write to the ledger AND update
-- balances atomically. Direct INSERTs into stock_ledger are blocked by RLS
-- for non-service roles (see RLS migration), but we keep this RPC pattern
-- so the application logic stays consistent.
-- =============================================================================

create or replace function app.apply_stock_movement(
  p_tenant_id        uuid,
  p_branch_id        uuid,
  p_product_id       uuid,
  p_variant_id       uuid,
  p_batch_id         uuid,
  p_movement_type    public.stock_movement_type,
  p_from_state       public.stock_state,
  p_to_state         public.stock_state,
  p_quantity         numeric,
  p_unit_cost        numeric,
  p_reference_type   text,
  p_reference_id     uuid,
  p_user_id          uuid,
  p_note             text default null
) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_ledger_id bigint;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'apply_stock_movement: quantity must be positive (got %)', p_quantity;
  end if;

  -- 1. Insert ledger row
  insert into public.stock_ledger (
    tenant_id, branch_id, product_id, variant_id, batch_id,
    movement_type, from_state, to_state, quantity, unit_cost,
    reference_type, reference_id, user_id, note
  ) values (
    p_tenant_id, p_branch_id, p_product_id, p_variant_id, p_batch_id,
    p_movement_type, p_from_state, p_to_state, p_quantity, p_unit_cost,
    p_reference_type, p_reference_id, p_user_id, p_note
  ) returning id into v_ledger_id;

  -- 2. Decrement source state if any
  if p_from_state is not null then
    insert into public.stock_balances (tenant_id, branch_id, product_id, variant_id, state, quantity)
    values (p_tenant_id, p_branch_id, p_product_id, p_variant_id, p_from_state, -p_quantity)
    on conflict (tenant_id, branch_id, product_id, variant_id, state)
    do update set quantity = public.stock_balances.quantity - p_quantity,
                  updated_at = now();
  end if;

  -- 3. Increment destination state if any
  if p_to_state is not null then
    insert into public.stock_balances (tenant_id, branch_id, product_id, variant_id, state, quantity)
    values (p_tenant_id, p_branch_id, p_product_id, p_variant_id, p_to_state, p_quantity)
    on conflict (tenant_id, branch_id, product_id, variant_id, state)
    do update set quantity = public.stock_balances.quantity + p_quantity,
                  updated_at = now();
  end if;

  return v_ledger_id;
end;
$$;

comment on function app.apply_stock_movement is 'Atomically write to stock_ledger and update stock_balances.';

-- =============================================================================
-- Stock adjustments (manager-approved corrections)
-- =============================================================================

create table public.stock_adjustments (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  branch_id     uuid not null references public.branches(id) on delete restrict,
  product_id    uuid not null references public.products(id) on delete restrict,
  variant_id    uuid references public.product_variants(id) on delete set null,
  state         public.stock_state not null default 'available',
  delta         numeric(14,4) not null,                -- can be negative
  reason        text not null,
  status        text not null default 'pending',       -- pending | approved | rejected
  requested_by  uuid references auth.users(id) on delete set null,
  approved_by   uuid references auth.users(id) on delete set null,
  approved_at   timestamptz,
  applied_ledger_id bigint references public.stock_ledger(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index stock_adjustments_tenant_idx on public.stock_adjustments (tenant_id);
create index stock_adjustments_branch_idx on public.stock_adjustments (branch_id);
create index stock_adjustments_status_idx on public.stock_adjustments (tenant_id, status);

create trigger stock_adjustments_set_updated_at
  before update on public.stock_adjustments
  for each row execute function app.set_updated_at();
