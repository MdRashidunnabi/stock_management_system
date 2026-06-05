-- Storefront website logo (top-left on public shop)

alter table public.tenant_storefronts
  add column if not exists logo_url text;

comment on column public.tenant_storefronts.logo_url is
  'Public URL for shop header logo (Supabase storage or site path).';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'storefront-logos',
  'storefront-logos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy storefront_logos_public_read on storage.objects
  for select
  using (bucket_id = 'storefront-logos');

create policy storefront_logos_authenticated_insert on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'storefront-logos');

create policy storefront_logos_authenticated_update on storage.objects
  for update
  to authenticated
  using (bucket_id = 'storefront-logos');

create policy storefront_logos_authenticated_delete on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'storefront-logos');

-- Default Needs Carlow logo (bundled under /public/shops/needscarlow/logo.png)
update public.tenant_storefronts ts
set logo_url = '/shops/needscarlow/logo.png'
from public.tenants t
where ts.tenant_id = t.id
  and t.slug = 'needscarlow'
  and (ts.logo_url is null or ts.logo_url = '');
