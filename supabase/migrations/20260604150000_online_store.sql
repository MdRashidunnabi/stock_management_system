-- =============================================================================
-- ShopOS - Online storefront (per-tenant shop pages + shared stock)
-- =============================================================================

create type public.online_order_status as enum (
  'pending',      -- placed, awaiting confirmation / delivery
  'confirmed',
  'cancelled',
  'fulfilled'
);

-- One row per tenant; created automatically on onboarding (see backfill below).
create table public.tenant_storefronts (
  tenant_id              uuid primary key references public.tenants(id) on delete cascade,
  enabled                boolean not null default true,
  branch_id              uuid references public.branches(id) on delete set null,
  tagline                text,
  phone                  text,
  whatsapp               text,
  hero_title             text,
  hero_subtitle          text,
  order_notice           text,
  low_stock_threshold    integer not null default 5 check (low_stock_threshold >= 0),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create trigger tenant_storefronts_set_updated_at
  before update on public.tenant_storefronts
  for each row execute function app.set_updated_at();

comment on table public.tenant_storefronts is
  'Public online shop settings. URL: /shop/{tenants.slug}. Stock is taken from branch_id (or first active branch).';

alter table public.tenant_storefronts enable row level security;

create policy tenant_storefronts_member_select on public.tenant_storefronts
  for select using (
    tenant_id in (select app.current_user_tenant_ids()) or app.is_super_admin()
  );

create policy tenant_storefronts_owner_write on public.tenant_storefronts
  for all using (
    app.has_tenant_role(tenant_id, array['owner','manager']::text[]) or app.is_super_admin()
  )
  with check (
    app.has_tenant_role(tenant_id, array['owner','manager']::text[]) or app.is_super_admin()
  );

-- Sequential web order numbers per tenant ---------------------------------------
create table public.online_order_counters (
  tenant_id   uuid primary key references public.tenants(id) on delete cascade,
  last_seq    bigint not null default 0,
  updated_at  timestamptz not null default now()
);

alter table public.online_order_counters enable row level security;

create policy online_order_counters_member_select on public.online_order_counters
  for select using (
    tenant_id in (select app.current_user_tenant_ids()) or app.is_super_admin()
  );

create or replace function app.next_online_order_number(p_tenant_id uuid)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_seq bigint;
begin
  insert into public.online_order_counters (tenant_id, last_seq, updated_at)
  values (p_tenant_id, 1, now())
  on conflict (tenant_id)
  do update set last_seq = public.online_order_counters.last_seq + 1,
                updated_at = now()
  returning last_seq into v_seq;

  return 'WEB-' || to_char(v_seq, 'FM000000');
end;
$$;

revoke execute on function app.next_online_order_number(uuid) from public;

-- Online orders ----------------------------------------------------------------
create table public.online_orders (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  branch_id         uuid not null references public.branches(id) on delete restrict,
  sale_id           uuid references public.sales(id) on delete set null,
  order_number      text not null,
  status            public.online_order_status not null default 'pending',
  customer_name     text not null,
  customer_phone    text not null,
  customer_email    citext,
  delivery_address  text,
  notes             text,
  subtotal          numeric(14,4) not null default 0,
  vat_total         numeric(14,4) not null default 0,
  total             numeric(14,4) not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (tenant_id, order_number)
);

create index online_orders_tenant_idx on public.online_orders (tenant_id, created_at desc);
create index online_orders_status_idx on public.online_orders (tenant_id, status);

create trigger online_orders_set_updated_at
  before update on public.online_orders
  for each row execute function app.set_updated_at();

alter table public.online_orders enable row level security;

create policy online_orders_member_select on public.online_orders
  for select using (
    tenant_id in (select app.current_user_tenant_ids()) or app.is_super_admin()
  );

create policy online_orders_member_update on public.online_orders
  for update using (
    app.has_tenant_role(tenant_id, array['owner','manager','warehouse','delivery']::text[])
    or app.is_super_admin()
  );

-- Order line snapshots ---------------------------------------------------------
create table public.online_order_items (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  online_order_id uuid not null references public.online_orders(id) on delete cascade,
  product_id      uuid not null references public.products(id) on delete restrict,
  position        integer not null default 0,
  name_snapshot   text not null,
  sku_snapshot    text,
  quantity        numeric(14,4) not null check (quantity > 0),
  unit_price      numeric(14,4) not null,
  line_total_gross numeric(14,4) not null,
  created_at      timestamptz not null default now()
);

create index online_order_items_order_idx on public.online_order_items (online_order_id);

alter table public.online_order_items enable row level security;

create policy online_order_items_member_select on public.online_order_items
  for select using (
    tenant_id in (select app.current_user_tenant_ids()) or app.is_super_admin()
  );

-- Link payments to online orders (column existed, add FK now) ------------------
alter table public.payments
  add constraint payments_online_order_id_fkey
  foreign key (online_order_id) references public.online_orders(id) on delete set null;

-- Backfill storefront rows for existing tenants --------------------------------
insert into public.tenant_storefronts (tenant_id, branch_id, enabled, hero_title, hero_subtitle, order_notice)
select
  t.id,
  (
    select b.id
    from public.branches b
    where b.tenant_id = t.id and b.is_active = true and b.is_warehouse = false
    order by b.created_at
    limit 1
  ),
  true,
  'Fresh groceries delivered to your door',
  'Order online — same stock as our shop',
  'We will call you to confirm delivery and payment.'
from public.tenants t
where t.status in ('trial', 'active', 'past_due')
on conflict (tenant_id) do nothing;

-- Needscarlow demo copy --------------------------------------------------------
update public.tenant_storefronts ts
set
  tagline = 'Asian & international groceries in Carlow',
  phone = '+353 59 913 0000',
  whatsapp = '+353 87 000 0000',
  hero_title = 'Get fresh, natural groceries delivered to your home',
  hero_subtitle = 'Same range as our Carlow shop — stock updates live with in-store sales',
  order_notice = 'Pay on delivery. We will confirm your order by phone or WhatsApp.'
from public.tenants t
where ts.tenant_id = t.id and t.slug = 'needscarlow';

-- Extend onboarding to auto-create storefront ----------------------------------
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
  p_branch_eircode       text default null
) returns table (tenant_id uuid, branch_id uuid, slug text)
language plpgsql security definer set search_path = '' as $$
declare
  v_user_id   uuid := auth.uid();
  v_tenant_id uuid;
  v_branch_id uuid;
  v_slug      text := lower(trim(coalesce(p_slug, '')));
  v_attempt   text;
  v_counter   int := 0;
  v_branch_name text;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if v_slug is null or length(v_slug) < 2 then
    raise exception 'slug must be at least 2 characters' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.user_tenants ut
    where ut.user_id = v_user_id
      and ut.is_active = true
  ) then
    raise exception 'caller already belongs to a tenant' using errcode = '42501';
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
    status, trial_ends_at, created_by, updated_by
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
    upper(trim(coalesce(p_branch_code, 'MAIN'))),
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

  insert into public.user_tenants (tenant_id, user_id, role, is_active)
  values (v_tenant_id, v_user_id, 'owner', true);

  insert into public.tenant_storefronts (tenant_id, branch_id, enabled, hero_title, hero_subtitle)
  values (
    v_tenant_id,
    v_branch_id,
    true,
    'Welcome to ' || trim(p_display_name),
    'Order online — stock stays in sync with our shop'
  );

  return query select v_tenant_id, v_branch_id, v_attempt;
end;
$$;

-- =============================================================================
-- commit_online_order: public checkout (called from trusted server via service role)
-- Deducts available stock immediately (same pool as POS).
-- =============================================================================
create or replace function public.commit_online_order(
  p_tenant_slug   text,
  p_items         jsonb,
  p_customer      jsonb,
  p_client_uuid   uuid default null
) returns table (
  online_order_id uuid,
  order_number    text,
  sale_id         uuid,
  total           numeric
)
language plpgsql security definer set search_path = '' as $$
declare
  v_tenant_id     uuid;
  v_branch_id     uuid;
  v_branch_code   text;
  v_store         record;
  v_order_id      uuid := gen_random_uuid();
  v_sale_id       uuid := gen_random_uuid();
  v_order_no      text;
  v_receipt_no    text;
  v_item          jsonb;
  v_position      integer := 0;
  v_product       record;
  v_qty           numeric(14,4);
  v_available     numeric(14,4);
  v_unit_price    numeric(14,4);
  v_unit_cost     numeric(14,4);
  v_vat_code      public.vat_code;
  v_vat_rate      numeric(6,4);
  v_vat_incl      boolean;
  v_line_gross    numeric(14,4);
  v_line_net      numeric(14,4);
  v_line_vat      numeric(14,4);
  v_subtotal      numeric(14,4) := 0;
  v_vat_total     numeric(14,4) := 0;
  v_total         numeric(14,4) := 0;
  v_breakdown     jsonb := '{}'::jsonb;
  v_existing      jsonb;
  v_idem          jsonb;
  v_cust_name     text;
  v_cust_phone    text;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'commit_online_order: items must be a non-empty array';
  end if;

  select t.id into v_tenant_id
    from public.tenants t
   where t.slug = lower(trim(p_tenant_slug))
     and t.status in ('trial', 'active', 'past_due');

  if v_tenant_id is null then
    raise exception 'commit_online_order: shop not found' using errcode = '23503';
  end if;

  select * into v_store
    from public.tenant_storefronts ts
   where ts.tenant_id = v_tenant_id and ts.enabled = true;

  if not found then
    raise exception 'commit_online_order: online store is not enabled for this shop' using errcode = '42501';
  end if;

  if p_client_uuid is not null then
    select response_body into v_idem
      from public.idempotency_keys
     where key = ('online:' || p_client_uuid::text)
       and tenant_id = v_tenant_id;
    if v_idem is not null then
      return query
        select
          (v_idem->>'online_order_id')::uuid,
          v_idem->>'order_number',
          (v_idem->>'sale_id')::uuid,
          (v_idem->>'total')::numeric;
      return;
    end if;
  end if;

  v_branch_id := v_store.branch_id;
  if v_branch_id is null then
    select b.id, b.code into v_branch_id, v_branch_code
      from public.branches b
     where b.tenant_id = v_tenant_id
       and b.is_active = true
       and b.is_warehouse = false
     order by b.created_at
     limit 1;
  else
    select code into v_branch_code from public.branches where id = v_branch_id;
  end if;

  if v_branch_id is null then
    raise exception 'commit_online_order: no active branch for fulfilment';
  end if;

  v_cust_name := trim(coalesce(p_customer->>'name', ''));
  v_cust_phone := trim(coalesce(p_customer->>'phone', ''));
  if length(v_cust_name) < 2 then
    raise exception 'commit_online_order: customer name is required';
  end if;
  if length(v_cust_phone) < 6 then
    raise exception 'commit_online_order: customer phone is required';
  end if;

  v_order_no := app.next_online_order_number(v_tenant_id);
  v_receipt_no := app.next_receipt_number(v_tenant_id, v_branch_id, coalesce(v_branch_code, 'WEB'));

  insert into public.online_orders (
    id, tenant_id, branch_id, order_number, status,
    customer_name, customer_phone, customer_email, delivery_address, notes
  ) values (
    v_order_id, v_tenant_id, v_branch_id, v_order_no, 'pending',
    v_cust_name, v_cust_phone,
    nullif(trim(coalesce(p_customer->>'email', '')), ''),
    nullif(trim(coalesce(p_customer->>'address', '')), ''),
    nullif(trim(coalesce(p_customer->>'notes', '')), '')
  );

  insert into public.sales (
    id, tenant_id, branch_id, channel, status, receipt_number, notes,
    subtotal, discount_total, vat_total, total, rounding, vat_breakdown
  ) values (
    v_sale_id, v_tenant_id, v_branch_id, 'online', 'completed', v_receipt_no,
    'Online order ' || v_order_no,
    0, 0, 0, 0, 0, '{}'::jsonb
  );

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_position := v_position + 1;
    v_qty := (v_item->>'qty')::numeric(14,4);

    if v_qty is null or v_qty <= 0 then
      raise exception 'commit_online_order: qty must be positive (item %)', v_position;
    end if;

    select id, name, sku, selling_price, purchase_price, vat_code, vat_included, is_active
      into v_product
      from public.products
     where id = (v_item->>'product_id')::uuid
       and tenant_id = v_tenant_id;

    if not found or not v_product.is_active then
      raise exception 'commit_online_order: product not available (item %)', v_position;
    end if;

    select coalesce(sb.quantity, 0) into v_available
      from public.stock_balances sb
     where sb.tenant_id = v_tenant_id
       and sb.branch_id = v_branch_id
       and sb.product_id = v_product.id
       and sb.variant_id is null
       and sb.state = 'available';

    v_available := coalesce(v_available, 0);
    if v_available < v_qty then
      raise exception 'commit_online_order: insufficient stock for % (have %, need %)',
        v_product.name, v_available, v_qty using errcode = '22023';
    end if;

    v_unit_price := v_product.selling_price;
    v_unit_cost  := v_product.purchase_price;
    v_vat_code   := v_product.vat_code;
    v_vat_incl   := v_product.vat_included;

    v_vat_rate := case v_vat_code
      when 'STD' then 0.23
      when 'RED' then 0.135
      when 'SEC' then 0.09
      when 'LIV' then 0.048
      when 'ZER' then 0.0
      when 'EXE' then 0.0
    end;

    if v_vat_incl then
      v_line_gross := round(v_unit_price * v_qty, 4);
      v_line_net := round(v_line_gross / (1 + v_vat_rate), 4);
      v_line_vat := round(v_line_gross - v_line_net, 4);
    else
      v_line_net := round(v_unit_price * v_qty, 4);
      v_line_vat := round(v_line_net * v_vat_rate, 4);
      v_line_gross := round(v_line_net + v_line_vat, 4);
    end if;

    insert into public.online_order_items (
      tenant_id, online_order_id, product_id, position,
      name_snapshot, sku_snapshot, quantity, unit_price, line_total_gross
    ) values (
      v_tenant_id, v_order_id, v_product.id, v_position,
      v_product.name, v_product.sku, v_qty, v_unit_price, v_line_gross
    );

    insert into public.sale_items (
      tenant_id, sale_id, product_id, position,
      name_snapshot, sku_snapshot, quantity, unit_price, unit_cost,
      vat_code, vat_rate, discount,
      line_total_gross, line_total_net, line_vat
    ) values (
      v_tenant_id, v_sale_id, v_product.id, v_position,
      v_product.name, v_product.sku, v_qty, v_unit_price, v_unit_cost,
      v_vat_code, v_vat_rate, 0,
      v_line_gross, v_line_net, v_line_vat
    );

    perform app.apply_stock_movement(
      v_tenant_id, v_branch_id, v_product.id, null, null,
      'pos_sale', 'available'::public.stock_state, null,
      v_qty, v_unit_cost,
      'online_order', v_order_id, null, 'Online order ' || v_order_no
    );

    v_subtotal := v_subtotal + v_line_net;
    v_vat_total := v_vat_total + v_line_vat;
    v_total := v_total + v_line_gross;

    v_existing := coalesce(v_breakdown->v_vat_code::text, jsonb_build_object('rate', v_vat_rate, 'base', 0, 'vat', 0));
    v_breakdown := jsonb_set(
      v_breakdown,
      array[v_vat_code::text],
      jsonb_build_object(
        'rate', v_vat_rate,
        'base', round(((v_existing->>'base')::numeric + v_line_net), 4),
        'vat',  round(((v_existing->>'vat')::numeric  + v_line_vat), 4)
      ),
      true
    );
  end loop;

  v_total := round(v_total, 2);

  update public.sales
     set subtotal = round(v_subtotal, 2),
         vat_total = round(v_vat_total, 2),
         total = v_total,
         vat_breakdown = v_breakdown
   where id = v_sale_id;

  update public.online_orders
     set sale_id = v_sale_id,
         subtotal = round(v_subtotal, 2),
         vat_total = round(v_vat_total, 2),
         total = v_total
   where id = v_order_id;

  insert into public.payments (
    tenant_id, sale_id, online_order_id, method, amount, status, captured_at
  ) values (
    v_tenant_id, v_sale_id, v_order_id, 'cash', v_total, 'pending', null
  );

  if p_client_uuid is not null then
    insert into public.idempotency_keys (key, tenant_id, user_id, response_body, status_code)
    values (
      'online:' || p_client_uuid::text,
      v_tenant_id,
      null,
      jsonb_build_object(
        'online_order_id', v_order_id,
        'order_number', v_order_no,
        'sale_id', v_sale_id,
        'total', v_total
      ),
      201
    )
    on conflict (key) do nothing;
  end if;

  return query select v_order_id, v_order_no, v_sale_id, v_total;
end;
$$;

comment on function public.commit_online_order is
  'Place an online order: validates stock, writes sale (channel=online), deducts available stock. Called from server with service role.';

revoke execute on function public.commit_online_order(text, jsonb, jsonb, uuid) from public;
grant execute on function public.commit_online_order(text, jsonb, jsonb, uuid) to service_role;
