-- Treat online_selling_price = 0 as "use auto markup" (empty form was saved as zero)

update public.products
set online_selling_price = null
where online_selling_price is not null and online_selling_price <= 0;

create or replace function app.online_product_unit_price(
  p_selling_price numeric,
  p_online_selling_price numeric,
  p_online_discount_pct numeric,
  p_markup_pct numeric
) returns numeric
language sql immutable parallel safe as $$
  select round(
    coalesce(
      nullif(p_online_selling_price, 0),
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
      nullif(p_online_selling_price, 0),
      round(p_selling_price * (1 + coalesce(p_markup_pct, 0.5) / 100), 4)
    ),
    2
  );
$$;
