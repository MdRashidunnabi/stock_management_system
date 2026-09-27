-- Stop a signed-in user from setting profiles.is_platform_staff on their own row.
-- Platform staff grants go through the service role (seed / platformGrantStaffAction).

create or replace function app.protect_is_platform_staff()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_platform_staff is not distinct from old.is_platform_staff then
    return new;
  end if;

  -- Service-role / SQL jobs have no auth.uid().
  if auth.uid() is null then
    return new;
  end if;

  if exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_platform_staff = true
  ) then
    return new;
  end if;

  raise exception 'Not allowed to change platform staff';
end;
$$;

drop trigger if exists protect_is_platform_staff on public.profiles;
create trigger protect_is_platform_staff
before update on public.profiles
for each row
execute function app.protect_is_platform_staff();
