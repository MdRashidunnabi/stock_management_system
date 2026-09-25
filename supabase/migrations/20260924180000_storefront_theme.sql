-- Public shop visual template chosen when publishing the online shop.

alter table public.tenant_storefronts
  add column if not exists theme_id text not null default 'market';

alter table public.tenant_storefronts
  drop constraint if exists tenant_storefronts_theme_id_chk;

alter table public.tenant_storefronts
  add constraint tenant_storefronts_theme_id_chk
  check (
    theme_id in (
      'market',
      'noir',
      'linen',
      'harbor',
      'blossom',
      'harvest',
      'metro',
      'grove',
      'sunset',
      'slate'
    )
  );

comment on column public.tenant_storefronts.theme_id is
  'Visual template for the public shop. Owners pick one when publishing.';
