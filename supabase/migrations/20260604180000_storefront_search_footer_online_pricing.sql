-- Footer content, social links, global online markup, per-product online price & discount

alter table public.tenant_storefronts
  add column if not exists footer_about text,
  add column if not exists call_us_label text default 'Call us now',
  add column if not exists facebook_url text,
  add column if not exists twitter_url text,
  add column if not exists youtube_url text,
  add column if not exists instagram_url text,
  add column if not exists online_price_markup_pct numeric(8,4) not null default 0.5;

comment on column public.tenant_storefronts.footer_about is
  'About column text on public shop footer.';
comment on column public.tenant_storefronts.online_price_markup_pct is
  'Default % added to in-store selling price for online shop when product has no manual online price.';

alter table public.products
  add column if not exists online_selling_price numeric(14,4),
  add column if not exists online_discount_pct numeric(6,2);

comment on column public.products.online_selling_price is
  'Manual online shop price (gross). Null = auto from selling_price + storefront markup %.';
comment on column public.products.online_discount_pct is
  'Online-only discount % off the online base price (0–100). Does not affect POS.';

-- Compute online unit price (gross, VAT-inclusive when product.vat_included)
create or replace function app.online_product_unit_price(
  p_selling_price numeric,
  p_online_selling_price numeric,
  p_online_discount_pct numeric,
  p_markup_pct numeric
) returns numeric
language sql immutable parallel safe as $$
  select round(
    coalesce(
      p_online_selling_price,
      round(p_selling_price * (1 + coalesce(p_markup_pct, 0.5) / 100), 4)
    ) * (1 - greatest(0, least(coalesce(p_online_discount_pct, 0), 100)) / 100),
    2
  );
$$;

create or replace function app.online_product_base_price(
  p_selling_price numeric,
  p_online_selling_price numeric,
  p_markup_pct numeric
) returns numeric
language sql immutable parallel safe as $$
  select round(
    coalesce(
      p_online_selling_price,
      round(p_selling_price * (1 + coalesce(p_markup_pct, 0.5) / 100), 4)
    ),
    2
  );
$$;

update public.tenant_storefronts ts
set
  footer_about = coalesce(
    ts.footer_about,
    'Needscarlow is more than just a grocery store — it is your gateway to the tastes of Asia, right in the heart of Carlow Town. We provide a diverse selection of essential products for your kitchen.'
  ),
  call_us_label = coalesce(ts.call_us_label, 'Call us now'),
  online_price_markup_pct = coalesce(ts.online_price_markup_pct, 0.5)
from public.tenants t
where ts.tenant_id = t.id and t.slug = 'needscarlow';
