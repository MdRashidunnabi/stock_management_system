-- Public bucket for product photos (tenant-scoped paths enforced in app layer).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy product_images_public_read on storage.objects
  for select
  using (bucket_id = 'product-images');

create policy product_images_authenticated_insert on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'product-images');

create policy product_images_authenticated_update on storage.objects
  for update
  to authenticated
  using (bucket_id = 'product-images');

create policy product_images_authenticated_delete on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'product-images');
