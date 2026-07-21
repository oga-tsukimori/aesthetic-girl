-- Give every new Aesthetic Girl sign-up guest access to the shared shop.

create or replace function public.assign_new_user_to_guest()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
begin
  select member.owner_id into v_owner
  from public.shop_members member
  where member.role = 'super_admin'
  order by member.created_at, member.user_id
  limit 1;

  if v_owner is null then
    select shop.owner_id into v_owner
    from public.shops shop
    order by shop.initialized_at, shop.owner_id
    limit 1;
  end if;

  if v_owner is not null then
    insert into public.shop_members (user_id, owner_id, role)
    values (new.id, v_owner, 'guest')
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

revoke all on function public.assign_new_user_to_guest() from public, anon, authenticated;

drop trigger if exists on_aesthetic_girl_user_created on auth.users;
create trigger on_aesthetic_girl_user_created
  after insert on auth.users
  for each row execute function public.assign_new_user_to_guest();

insert into public.shop_members (user_id, owner_id, role)
select user_row.id, owner_shop.owner_id, 'guest'
from auth.users user_row
cross join lateral (
  select coalesce(
    (
      select member.owner_id
      from public.shop_members member
      where member.role = 'super_admin'
      order by member.created_at, member.user_id
      limit 1
    ),
    (
      select shop.owner_id
      from public.shops shop
      order by shop.initialized_at, shop.owner_id
      limit 1
    )
  ) as owner_id
) owner_shop
where owner_shop.owner_id is not null
on conflict (user_id) do nothing;

notify pgrst, 'reload schema';
