alter table public.tenant_storefronts
  add column if not exists voucher_earn_pct numeric(5,2) not null default 5;

comment on column public.tenant_storefronts.voucher_earn_pct is
  'Percent of product spend, after any voucher used, that becomes the next voucher. 5 means 5%.';
