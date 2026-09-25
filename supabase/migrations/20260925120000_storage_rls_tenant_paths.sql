-- Tenant-scoped storage object paths + tighter audit-log reads.
-- App uploads already prefix objects with {tenant_id}/…; policies now enforce that.

-- Product images: authenticated users may only write under their tenant folder,
-- and only catalog staff (or platform super-admins) may mutate objects.
drop policy if exists product_images_authenticated_insert on storage.objects;
drop policy if exists product_images_authenticated_update on storage.objects;
drop policy if exists product_images_authenticated_delete on storage.objects;

create policy product_images_authenticated_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and ((storage.foldername(name))[1])::uuid in (select app.current_user_tenant_ids())
    and (
      app.has_tenant_role(
        ((storage.foldername(name))[1])::uuid,
        array['owner','manager','warehouse']::text[]
      )
      or app.is_super_admin()
    )
  );

create policy product_images_authenticated_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and ((storage.foldername(name))[1])::uuid in (select app.current_user_tenant_ids())
    and (
      app.has_tenant_role(
        ((storage.foldername(name))[1])::uuid,
        array['owner','manager','warehouse']::text[]
      )
      or app.is_super_admin()
    )
  )
  with check (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and ((storage.foldername(name))[1])::uuid in (select app.current_user_tenant_ids())
  );

create policy product_images_authenticated_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and ((storage.foldername(name))[1])::uuid in (select app.current_user_tenant_ids())
    and (
      app.has_tenant_role(
        ((storage.foldername(name))[1])::uuid,
        array['owner','manager','warehouse']::text[]
      )
      or app.is_super_admin()
    )
  );

-- Storefront logos: same tenant-folder rule; no SVG (stored XSS).
update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
where id = 'storefront-logos';

drop policy if exists storefront_logos_authenticated_insert on storage.objects;
drop policy if exists storefront_logos_authenticated_update on storage.objects;
drop policy if exists storefront_logos_authenticated_delete on storage.objects;

create policy storefront_logos_authenticated_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'storefront-logos'
    and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and ((storage.foldername(name))[1])::uuid in (select app.current_user_tenant_ids())
    and (
      app.has_tenant_role(
        ((storage.foldername(name))[1])::uuid,
        array['owner','manager','super_admin']::text[]
      )
      or app.is_super_admin()
    )
  );

create policy storefront_logos_authenticated_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'storefront-logos'
    and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and ((storage.foldername(name))[1])::uuid in (select app.current_user_tenant_ids())
    and (
      app.has_tenant_role(
        ((storage.foldername(name))[1])::uuid,
        array['owner','manager','super_admin']::text[]
      )
      or app.is_super_admin()
    )
  )
  with check (
    bucket_id = 'storefront-logos'
    and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and ((storage.foldername(name))[1])::uuid in (select app.current_user_tenant_ids())
  );

create policy storefront_logos_authenticated_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'storefront-logos'
    and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and ((storage.foldername(name))[1])::uuid in (select app.current_user_tenant_ids())
    and (
      app.has_tenant_role(
        ((storage.foldername(name))[1])::uuid,
        array['owner','manager','super_admin']::text[]
      )
      or app.is_super_admin()
    )
  );

-- Audit log reads: not every shop member.
drop policy if exists audit_logs_member_select on public.audit_logs;

create policy audit_logs_staff_select on public.audit_logs
  for select using (
    app.has_tenant_role(
      tenant_id,
      array['owner','manager','accountant','support_admin','super_admin']::text[]
    )
    or app.is_super_admin()
  );
