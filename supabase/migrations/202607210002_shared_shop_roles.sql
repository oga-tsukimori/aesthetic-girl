-- Shared Aesthetic Girl workspace with database-enforced account roles.

create table if not exists public.shop_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  owner_id uuid not null references public.shops(owner_id) on delete cascade,
  role text not null check (role in ('super_admin', 'staff', 'guest')),
  created_at timestamptz not null default now()
);

create index if not exists shop_members_owner_idx on public.shop_members (owner_id);
alter table public.shop_members enable row level security;

create or replace function public.current_shop_owner()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select member.owner_id
  from public.shop_members member
  where member.user_id = (select auth.uid());
$$;

create or replace function public.current_shop_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select member.role
  from public.shop_members member
  where member.user_id = (select auth.uid());
$$;

revoke all on function public.current_shop_owner() from public, anon;
revoke all on function public.current_shop_role() from public, anon;
grant execute on function public.current_shop_owner() to authenticated;
grant execute on function public.current_shop_role() to authenticated;

insert into public.shop_members (user_id, owner_id, role)
select user_row.id, owner_shop.owner_id,
  case lower(user_row.email)
    when 'uxuibyyoonnadi@gmail.com' then 'super_admin'
    when 'perfectjuno3645@gmail.com' then 'staff'
    when 'guest@email.com' then 'guest'
  end
from auth.users user_row
cross join lateral (
  select shop.owner_id
  from public.shops shop
  order by shop.initialized_at
  limit 1
) owner_shop
where lower(user_row.email) in (
  'uxuibyyoonnadi@gmail.com',
  'perfectjuno3645@gmail.com',
  'guest@email.com'
)
on conflict (user_id) do update
set owner_id = excluded.owner_id, role = excluded.role;

drop policy if exists "owners manage their shop" on public.shops;
drop policy if exists "members view their shop" on public.shops;
drop policy if exists "admins manage their shop" on public.shops;
create policy "members view their shop" on public.shops
  for select to authenticated
  using (owner_id = (select public.current_shop_owner()));
create policy "admins manage their shop" on public.shops
  for all to authenticated
  using (
    owner_id = (select public.current_shop_owner())
    and (select public.current_shop_role()) = 'super_admin'
  )
  with check (
    owner_id = (select public.current_shop_owner())
    and (select public.current_shop_role()) = 'super_admin'
  );

drop policy if exists "owners manage their products" on public.products;
drop policy if exists "members view products" on public.products;
drop policy if exists "editors manage products" on public.products;
create policy "members view products" on public.products
  for select to authenticated
  using (owner_id = (select public.current_shop_owner()));
create policy "editors manage products" on public.products
  for all to authenticated
  using (
    owner_id = (select public.current_shop_owner())
    and (select public.current_shop_role()) in ('super_admin', 'staff')
  )
  with check (
    owner_id = (select public.current_shop_owner())
    and (select public.current_shop_role()) in ('super_admin', 'staff')
  );

drop policy if exists "owners manage their orders" on public.orders;
drop policy if exists "members view orders" on public.orders;
drop policy if exists "editors manage orders" on public.orders;
create policy "members view orders" on public.orders
  for select to authenticated
  using (owner_id = (select public.current_shop_owner()));
create policy "editors manage orders" on public.orders
  for all to authenticated
  using (
    owner_id = (select public.current_shop_owner())
    and (select public.current_shop_role()) in ('super_admin', 'staff')
  )
  with check (
    owner_id = (select public.current_shop_owner())
    and (select public.current_shop_role()) in ('super_admin', 'staff')
  );

drop policy if exists "owners manage their sales" on public.sales;
drop policy if exists "members view sales" on public.sales;
drop policy if exists "editors manage sales" on public.sales;
create policy "members view sales" on public.sales
  for select to authenticated
  using (owner_id = (select public.current_shop_owner()));
create policy "editors manage sales" on public.sales
  for all to authenticated
  using (
    owner_id = (select public.current_shop_owner())
    and (select public.current_shop_role()) in ('super_admin', 'staff')
  )
  with check (
    owner_id = (select public.current_shop_owner())
    and (select public.current_shop_role()) in ('super_admin', 'staff')
  );

drop policy if exists "owners manage their expenses" on public.expenses;
drop policy if exists "financial roles view expenses" on public.expenses;
drop policy if exists "admins manage expenses" on public.expenses;
create policy "financial roles view expenses" on public.expenses
  for select to authenticated
  using (
    owner_id = (select public.current_shop_owner())
    and (select public.current_shop_role()) in ('super_admin', 'guest')
  );
create policy "admins manage expenses" on public.expenses
  for all to authenticated
  using (
    owner_id = (select public.current_shop_owner())
    and (select public.current_shop_role()) = 'super_admin'
  )
  with check (
    owner_id = (select public.current_shop_owner())
    and (select public.current_shop_role()) = 'super_admin'
  );

drop policy if exists "members read their access" on public.shop_members;
drop policy if exists "admins manage members" on public.shop_members;
create policy "members read their access" on public.shop_members
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (
      owner_id = (select public.current_shop_owner())
      and (select public.current_shop_role()) = 'super_admin'
    )
  );
create policy "admins manage members" on public.shop_members
  for all to authenticated
  using (
    owner_id = (select public.current_shop_owner())
    and (select public.current_shop_role()) = 'super_admin'
  )
  with check (
    owner_id = (select public.current_shop_owner())
    and (select public.current_shop_role()) = 'super_admin'
  );

grant select, insert, update, delete on public.shop_members to authenticated;

create or replace function public.adjust_product(p_product_id text, p_amount integer)
returns setof public.products
language plpgsql
security invoker
set search_path = public
as $$
begin
  if coalesce(public.current_shop_role(), '') not in ('super_admin', 'staff') then
    raise exception 'This account is read-only';
  end if;

  return query
  update public.products
  set qty = greatest(0, qty + p_amount)
  where owner_id = public.current_shop_owner() and id = p_product_id
  returning *;
end;
$$;

create or replace function public.create_shop_order(p_order jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_owner uuid := public.current_shop_owner();
  v_order_id text := coalesce(nullif(p_order->>'id', ''), 'o_' || replace(gen_random_uuid()::text, '-', ''));
  v_date date;
  v_fulfilment text := coalesce(p_order->>'fulfilment', 'instock');
  v_payment text := coalesce(p_order->>'payment', 'cod');
  v_item jsonb;
  v_product public.products%rowtype;
  v_product_id text;
  v_name text;
  v_qty integer;
  v_unit numeric;
  v_line_total numeric;
  v_total numeric := 0;
  v_items jsonb := '[]'::jsonb;
  v_order_row jsonb;
  v_sales_rows jsonb;
begin
  if v_owner is null then raise exception 'This account is not assigned to a shop'; end if;
  if coalesce(public.current_shop_role(), '') not in ('super_admin', 'staff') then raise exception 'This account is read-only'; end if;
  if jsonb_typeof(p_order->'items') <> 'array' or jsonb_array_length(p_order->'items') = 0 then
    raise exception 'An order needs at least one item';
  end if;
  if v_fulfilment not in ('instock', 'preorder') then raise exception 'Invalid fulfilment'; end if;
  if v_payment not in ('cod', 'kpay') then raise exception 'Invalid payment'; end if;
  v_date := (p_order->>'date')::date;

  insert into public.orders (
    owner_id, id, date, customer, phone, address, fulfilment, payment, note, total, items, created_at
  ) values (
    v_owner, v_order_id, v_date, trim(coalesce(p_order->>'customer', '')),
    trim(coalesce(p_order->>'phone', '')), trim(coalesce(p_order->>'address', '')),
    v_fulfilment, v_payment, nullif(trim(coalesce(p_order->>'note', '')), ''), 0, '[]'::jsonb,
    coalesce((p_order->>'createdAt')::timestamptz, now())
  );

  for v_item in select value from jsonb_array_elements(p_order->'items')
  loop
    v_product_id := nullif(v_item->>'productId', '');
    v_qty := (v_item->>'qty')::integer;
    v_unit := (v_item->>'unit')::numeric;
    if v_qty is null or v_qty <= 0 then raise exception 'Item quantity must be above zero'; end if;
    if v_unit is null or v_unit <= 0 then raise exception 'Item price must be above zero'; end if;

    v_product := null;
    if v_product_id is not null then
      select * into v_product from public.products
      where owner_id = v_owner and id = v_product_id;
      if not found then v_product_id := null; end if;
    end if;

    v_name := trim(coalesce(nullif(v_item->>'item', ''), v_product.name, ''));
    if v_name = '' then raise exception 'Every line needs a product'; end if;
    v_line_total := v_qty * v_unit;

    if v_fulfilment = 'instock' and v_product_id is not null then
      update public.products
      set qty = qty - v_qty
      where owner_id = v_owner and id = v_product_id and qty >= v_qty
      returning * into v_product;
      if not found then raise exception 'Not enough stock for %', v_name; end if;
    end if;

    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'productId', v_product_id, 'item', v_name, 'qty', v_qty,
      'unit', v_unit, 'total', v_line_total
    ));
    v_total := v_total + v_line_total;

    insert into public.sales (
      owner_id, id, order_id, product_id, date, item, qty, unit, total, note, cat,
      customer, phone, address, fulfilment, payment
    ) values (
      v_owner, 's_' || replace(gen_random_uuid()::text, '-', ''), v_order_id, v_product_id,
      v_date, v_name, v_qty, v_unit, v_line_total, nullif(trim(coalesce(p_order->>'note', '')), ''),
      coalesce(v_product.category, 'Other'), nullif(trim(coalesce(p_order->>'customer', '')), ''),
      nullif(trim(coalesce(p_order->>'phone', '')), ''), nullif(trim(coalesce(p_order->>'address', '')), ''),
      v_fulfilment, v_payment
    );
  end loop;

  update public.orders set items = v_items, total = v_total
  where owner_id = v_owner and id = v_order_id;

  select to_jsonb(order_row) into v_order_row from public.orders order_row
  where order_row.owner_id = v_owner and order_row.id = v_order_id;
  select coalesce(jsonb_agg(to_jsonb(sale_row) order by sale_row.id), '[]'::jsonb) into v_sales_rows
  from public.sales sale_row where sale_row.owner_id = v_owner and sale_row.order_id = v_order_id;

  return jsonb_build_object('order', v_order_row, 'sales', v_sales_rows);
end;
$$;

create or replace function public.delete_shop_order(p_order_id text)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_owner uuid := public.current_shop_owner();
  v_order public.orders%rowtype;
  v_item jsonb;
begin
  if coalesce(public.current_shop_role(), '') not in ('super_admin', 'staff') then raise exception 'This account is read-only'; end if;

  select * into v_order from public.orders
  where owner_id = v_owner and id = p_order_id for update;
  if not found then return false; end if;

  if v_order.fulfilment <> 'preorder' then
    for v_item in select value from jsonb_array_elements(v_order.items)
    loop
      if nullif(v_item->>'productId', '') is not null then
        update public.products set qty = qty + (v_item->>'qty')::integer
        where owner_id = v_owner and id = v_item->>'productId';
      end if;
    end loop;
  end if;

  delete from public.sales where owner_id = v_owner and order_id = p_order_id;
  delete from public.orders where owner_id = v_owner and id = p_order_id;
  return true;
end;
$$;

create or replace function public.delete_shop_sale(p_sale_id text)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_owner uuid := public.current_shop_owner();
  v_sale public.sales%rowtype;
begin
  if coalesce(public.current_shop_role(), '') not in ('super_admin', 'staff') then raise exception 'This account is read-only'; end if;

  select * into v_sale from public.sales
  where owner_id = v_owner and id = p_sale_id for update;
  if not found then return false; end if;

  if v_sale.fulfilment <> 'preorder' and v_sale.product_id is not null then
    update public.products set qty = qty + v_sale.qty
    where owner_id = v_owner and id = v_sale.product_id;
  end if;
  delete from public.sales where owner_id = v_owner and id = p_sale_id;

  if v_sale.order_id is not null then
    update public.orders order_row
    set items = (
      select coalesce(jsonb_agg(entry), '[]'::jsonb)
      from jsonb_array_elements(order_row.items) entry
      where entry->>'item' <> v_sale.item
    ), total = greatest(0, order_row.total - v_sale.total)
    where order_row.owner_id = v_owner and order_row.id = v_sale.order_id;
    delete from public.orders
    where owner_id = v_owner and id = v_sale.order_id and jsonb_array_length(items) = 0;
  end if;
  return true;
end;
$$;

revoke all on function public.adjust_product(text, integer) from public, anon;
revoke all on function public.create_shop_order(jsonb) from public, anon;
revoke all on function public.delete_shop_order(text) from public, anon;
revoke all on function public.delete_shop_sale(text) from public, anon;
grant execute on function public.adjust_product(text, integer) to authenticated;
grant execute on function public.create_shop_order(jsonb) to authenticated;
grant execute on function public.delete_shop_order(text) to authenticated;
grant execute on function public.delete_shop_sale(text) to authenticated;

notify pgrst, 'reload schema';
