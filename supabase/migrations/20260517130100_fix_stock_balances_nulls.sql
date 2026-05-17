-- =============================================================================
-- ShopOS - Step 8 - Fix: stock_balances unique key needs NULLS NOT DISTINCT
-- =============================================================================
--
-- The original constraint was `unique (tenant_id, branch_id, product_id,
-- variant_id, state)` which uses Postgres's default NULLS DISTINCT semantics.
-- That means two rows with variant_id IS NULL (i.e. the common case of a
-- product with no variants) are treated as DIFFERENT rows by the unique key,
-- so app.apply_stock_movement's `on conflict ... do update` never matches.
-- The result is duplicate balance rows being inserted instead of a single
-- running tally.
--
-- Fix: collapse any duplicates that already exist, then re-create the unique
-- constraint with NULLS NOT DISTINCT so NULL variant_id rows are coalesced.
-- =============================================================================

-- 1. Collapse any duplicate (tenant, branch, product, NULL variant, state)
-- rows into a single one before adding the stricter constraint. We use
-- (array_agg(id order by updated_at)) [1] because Postgres has no min(uuid).
with ranked as (
  select id,
         tenant_id, branch_id, product_id, state,
         sum(quantity) over w as total_qty,
         row_number() over w  as rn
    from public.stock_balances
   where variant_id is null
  window w as (
    partition by tenant_id, branch_id, product_id, state
    order by updated_at, id
  )
)
update public.stock_balances sb
   set quantity = r.total_qty,
       updated_at = now()
  from ranked r
 where sb.id = r.id
   and r.rn = 1
   and r.total_qty <> sb.quantity;

delete from public.stock_balances sb
 using (
   select id
     from (
       select id,
              row_number() over (
                partition by tenant_id, branch_id, product_id, state
                order by updated_at, id
              ) as rn
         from public.stock_balances
        where variant_id is null
     ) ranked
    where rn > 1
 ) dup
 where sb.id = dup.id;

-- 2. Drop the old unique constraint and add the NULLS NOT DISTINCT version.
alter table public.stock_balances
  drop constraint if exists stock_balances_tenant_id_branch_id_product_id_variant_id_st_key;

alter table public.stock_balances
  add constraint stock_balances_unique_loc
  unique nulls not distinct (tenant_id, branch_id, product_id, variant_id, state);

comment on constraint stock_balances_unique_loc on public.stock_balances is
  'NULL variant_id is treated as equal so apply_stock_movement upserts a single row per (tenant,branch,product,state) for products without variants.';
