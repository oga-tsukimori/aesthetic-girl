-- Aesthetic Girl inventory schema
-- Every row belongs to an authenticated Supabase user. The browser only uses
-- the publishable key; these RLS policies are the authorization boundary.

create table if not exists public.shops (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  initialized_at timestamptz not null default now()
);

create table if not exists public.products (
  owner_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  name text not null,
  category text not null default 'Other',
  qty integer not null default 0 check (qty >= 0),
  price numeric,
  photo text,
  color text,
  model text,
  base text,
  primary key (owner_id, id)
);

create table if not exists public.orders (
  owner_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  date date not null,
  customer text not null default '',
  phone text not null default '',
  address text not null default '',
  fulfilment text not null check (fulfilment in ('instock', 'preorder')),
  payment text not null check (payment in ('cod', 'kpay')),
  note text,
  total numeric not null default 0,
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  primary key (owner_id, id)
);

create table if not exists public.sales (
  owner_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  order_id text,
  product_id text,
  date date not null,
  item text not null,
  qty integer not null check (qty > 0),
  unit numeric not null check (unit > 0),
  total numeric not null check (total >= 0),
  note text,
  cat text not null default 'Other',
  customer text,
  phone text,
  address text,
  fulfilment text not null default 'instock' check (fulfilment in ('instock', 'preorder')),
  payment text check (payment is null or payment in ('cod', 'kpay')),
  primary key (owner_id, id)
);

create table if not exists public.expenses (
  owner_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  date date not null,
  category text not null default 'Other',
  amount numeric not null check (amount > 0),
  note text not null,
  primary key (owner_id, id)
);

create index if not exists products_owner_name_idx on public.products (owner_id, name);
create index if not exists orders_owner_date_idx on public.orders (owner_id, date);
create index if not exists sales_owner_date_idx on public.sales (owner_id, date);
create index if not exists sales_owner_order_idx on public.sales (owner_id, order_id);
create index if not exists expenses_owner_date_idx on public.expenses (owner_id, date);

alter table public.shops enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.sales enable row level security;
alter table public.expenses enable row level security;

drop policy if exists "owners manage their shop" on public.shops;
create policy "owners manage their shop" on public.shops
  for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

drop policy if exists "owners manage their products" on public.products;
create policy "owners manage their products" on public.products
  for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

drop policy if exists "owners manage their orders" on public.orders;
create policy "owners manage their orders" on public.orders
  for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

drop policy if exists "owners manage their sales" on public.sales;
create policy "owners manage their sales" on public.sales
  for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

drop policy if exists "owners manage their expenses" on public.expenses;
create policy "owners manage their expenses" on public.expenses
  for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

revoke all on public.shops, public.products, public.orders, public.sales, public.expenses from anon;
grant select, insert, update, delete on public.shops, public.products, public.orders, public.sales, public.expenses to authenticated;

create or replace function public.adjust_product(p_product_id text, p_amount integer)
returns setof public.products
language sql
security invoker
set search_path = public
as $$
  update public.products
  set qty = greatest(0, qty + p_amount)
  where owner_id = auth.uid() and id = p_product_id
  returning *;
$$;

create or replace function public.create_shop_order(p_order jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_owner uuid := auth.uid();
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
  if v_owner is null then raise exception 'Please sign in again'; end if;
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

  select to_jsonb(o) into v_order_row from public.orders o
  where o.owner_id = v_owner and o.id = v_order_id;
  select coalesce(jsonb_agg(to_jsonb(s) order by s.id), '[]'::jsonb) into v_sales_rows
  from public.sales s where s.owner_id = v_owner and s.order_id = v_order_id;

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
  v_owner uuid := auth.uid();
  v_order public.orders%rowtype;
  v_item jsonb;
begin
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
  v_owner uuid := auth.uid();
  v_sale public.sales%rowtype;
begin
  select * into v_sale from public.sales
  where owner_id = v_owner and id = p_sale_id for update;
  if not found then return false; end if;

  if v_sale.fulfilment <> 'preorder' and v_sale.product_id is not null then
    update public.products set qty = qty + v_sale.qty
    where owner_id = v_owner and id = v_sale.product_id;
  end if;
  delete from public.sales where owner_id = v_owner and id = p_sale_id;

  if v_sale.order_id is not null then
    update public.orders o
    set items = (
      select coalesce(jsonb_agg(entry), '[]'::jsonb)
      from jsonb_array_elements(o.items) entry
      where entry->>'item' <> v_sale.item
    ), total = greatest(0, o.total - v_sale.total)
    where o.owner_id = v_owner and o.id = v_sale.order_id;
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
