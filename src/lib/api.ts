import type { Expense, Order, Product, Sale } from '@/data'
import { SEED_EXPENSES, SEED_PRODUCTS, SEED_SALES } from '@/data'
import { supabase, supabaseConfigured } from '@/lib/supabase'

export type AccessRole = 'super_admin' | 'staff' | 'guest'
export type Snapshot = {
  products: Product[]
  sales: Sale[]
  expenses: Expense[]
  orders: Order[]
  role: AccessRole
}

export type AdminUser = {
  id: string
  email: string
  role: AccessRole
  createdAt: string
  isCurrent: boolean
}

export let online = false

type Row = Record<string, unknown>

const value = (input: unknown) => Number(input ?? 0)
const makeId = (prefix: string) => `${prefix}_${crypto.randomUUID().replaceAll('-', '')}`

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

async function adminRequest<T>(init?: RequestInit): Promise<T> {
  const { data, error } = await supabase.auth.getSession()
  fail(error)
  const token = data.session?.access_token
  if (!token) throw new Error('Please sign in again')

  const response = await fetch('/api/admin/users', {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })
  const result = (await response.json().catch(() => ({}))) as { error?: string } & T
  if (!response.ok) throw new Error(result.error || 'Could not update user accounts')
  return result
}

async function currentAccess() {
  const { data: authData, error: authError } = await supabase.auth.getUser()
  fail(authError)
  if (!authData.user) throw new Error('Please sign in again')

  const { data, error } = await supabase
    .from('shop_members')
    .select('owner_id, role')
    .eq('user_id', authData.user.id)
    .single()
  if (error) {
    if ('code' in error && error.code === 'PGRST116') {
      throw new Error('This account has not been assigned to the Aesthetic Girl workspace')
    }
    fail(error)
  }

  if (!data) throw new Error('This account has not been assigned to the Aesthetic Girl workspace')
  const role = data.role
  if (role !== 'super_admin' && role !== 'staff' && role !== 'guest') {
    throw new Error('This account has an invalid workspace role')
  }
  return { ownerId: String(data.owner_id), role }
}

function productFrom(row: Row): Product {
  return {
    id: String(row.id),
    name: String(row.name),
    category: String(row.category),
    qty: value(row.qty),
    price: row.price == null ? null : value(row.price),
    photo: row.photo == null ? null : String(row.photo),
    color: row.color == null ? null : String(row.color),
    model: row.model == null ? null : String(row.model),
    base: row.base == null ? undefined : String(row.base),
  }
}

function saleFrom(row: Row): Sale {
  return {
    id: String(row.id),
    date: String(row.date),
    item: String(row.item),
    qty: value(row.qty),
    unit: value(row.unit),
    total: value(row.total),
    note: row.note == null ? null : String(row.note),
    cat: String(row.cat),
    orderId: row.order_id == null ? null : String(row.order_id),
    customer: row.customer == null ? null : String(row.customer),
    phone: row.phone == null ? null : String(row.phone),
    address: row.address == null ? null : String(row.address),
    fulfilment: row.fulfilment === 'preorder' ? 'preorder' : 'instock',
    payment: row.payment === 'cod' || row.payment === 'kpay' ? row.payment : null,
  }
}

function orderFrom(row: Row): Order {
  return {
    id: String(row.id),
    date: String(row.date),
    customer: String(row.customer ?? ''),
    phone: String(row.phone ?? ''),
    address: String(row.address ?? ''),
    fulfilment: row.fulfilment === 'preorder' ? 'preorder' : 'instock',
    payment: row.payment === 'kpay' ? 'kpay' : 'cod',
    note: row.note == null ? null : String(row.note),
    total: value(row.total),
    items: Array.isArray(row.items) ? (row.items as Order['items']) : [],
    createdAt: String(row.created_at),
  }
}

function expenseFrom(row: Row): Expense {
  return {
    id: String(row.id),
    date: String(row.date),
    category: String(row.category),
    note: String(row.note),
    amount: value(row.amount),
  }
}

/** Supabase caps each REST response at 1,000 rows, so read large tables page by page. */
async function selectAll(table: string, orderColumn: string, ascending = true) {
  const pageSize = 1000
  const rows: Row[] = []

  for (let start = 0; ; start += pageSize) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order(orderColumn, { ascending })
      .order('id', { ascending: true })
      .range(start, start + pageSize - 1)
    fail(error)

    const page = (data ?? []) as Row[]
    rows.push(...page)
    if (page.length < pageSize) return rows
  }
}

/** Load the signed-in user's Supabase data; retain an offline fallback for local builds. */
export async function loadSnapshot(): Promise<Snapshot> {
  if (!supabaseConfigured) {
    online = false
    return {
      products: SEED_PRODUCTS,
      sales: SEED_SALES,
      expenses: SEED_EXPENSES,
      orders: [],
      role: 'super_admin',
    }
  }

  try {
    const { role } = await currentAccess()
    const [productRows, saleRows, expenseRows, orderRows] = await Promise.all([
      selectAll('products', 'name'),
      selectAll('sales', 'date'),
      role === 'staff' ? Promise.resolve([] as Row[]) : selectAll('expenses', 'date'),
      selectAll('orders', 'created_at', false),
    ])
    online = true
    return {
      products: productRows.map(productFrom),
      sales: saleRows.map(saleFrom),
      expenses: expenseRows.map(expenseFrom),
      orders: orderRows.map(orderFrom),
      role,
    }
  } catch (error) {
    online = false
    throw error
  }
}

export type OrderInput = {
  customer: string
  phone: string
  address: string
  date: string
  fulfilment: 'instock' | 'preorder'
  payment: 'cod' | 'kpay'
  note: string
  items: { productId: string | null; item: string; qty: number; unit: number }[]
}

export const api = {
  adminUsers: {
    list: async () => {
      const result = await adminRequest<{ users: AdminUser[] }>()
      return result.users
    },

    create: async (email: string, password: string) => {
      const result = await adminRequest<{ user: AdminUser }>({
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      return result.user
    },

    changePassword: async (id: string, password: string) => {
      await adminRequest<{ ok: true }>({
        method: 'PATCH',
        body: JSON.stringify({ id, password }),
      })
    },

    remove: async (id: string) => {
      await adminRequest<{ ok: true }>({
        method: 'DELETE',
        body: JSON.stringify({ id }),
      })
    },
  },

  createProduct: async (product: Partial<Product>) => {
    const { ownerId } = await currentAccess()
    const { data, error } = await supabase
      .from('products')
      .insert({
        owner_id: ownerId,
        id: makeId('p'),
        name: product.name,
        category: product.category ?? 'Other',
        qty: product.qty ?? 0,
        price: product.price ?? null,
        photo: product.photo ?? null,
        color: product.color ?? null,
        model: product.model ?? null,
        base: product.base ?? null,
      })
      .select()
      .single()
    fail(error)
    return productFrom(data as Row)
  },

  updateProduct: async (id: string, patch: Partial<Product>) => {
    const { id: _ignored, ...changes } = patch
    void _ignored
    const { data, error } = await supabase.from('products').update(changes).eq('id', id).select().single()
    fail(error)
    return productFrom(data as Row)
  },

  adjustProduct: async (id: string, by: number) => {
    const { data, error } = await supabase.rpc('adjust_product', { p_product_id: id, p_amount: by })
    fail(error)
    const row = Array.isArray(data) ? data[0] : data
    return productFrom(row as Row)
  },

  deleteProduct: async (id: string) => {
    const { error } = await supabase.from('products').delete().eq('id', id)
    fail(error)
  },

  createOrder: async (order: OrderInput) => {
    const { data, error } = await supabase.rpc('create_shop_order', {
      p_order: { ...order, id: makeId('o'), createdAt: new Date().toISOString() },
    })
    fail(error)
    const result = data as { order: Row; sales: Row[] }
    return { order: orderFrom(result.order), sales: result.sales.map(saleFrom) }
  },

  updateOrder: async (id: string, patch: Partial<OrderInput>) => {
    const orderChanges: Row = {}
    for (const key of ['customer', 'phone', 'address', 'date', 'fulfilment', 'payment', 'note'] as const) {
      if (patch[key] !== undefined) orderChanges[key] = patch[key]
    }
    const { data, error } = await supabase.from('orders').update(orderChanges).eq('id', id).select().single()
    fail(error)
    const saleChanges = { ...orderChanges }
    const { error: salesError } = await supabase.from('sales').update(saleChanges).eq('order_id', id)
    fail(salesError)
    return orderFrom(data as Row)
  },

  deleteOrder: async (id: string) => {
    const { error } = await supabase.rpc('delete_shop_order', { p_order_id: id })
    fail(error)
  },

  deleteSale: async (id: string) => {
    const { error } = await supabase.rpc('delete_shop_sale', { p_sale_id: id })
    fail(error)
  },

  createExpense: async (expense: Partial<Expense>) => {
    const { ownerId } = await currentAccess()
    const { data, error } = await supabase
      .from('expenses')
      .insert({
        owner_id: ownerId,
        id: makeId('e'),
        date: expense.date,
        category: expense.category ?? 'Other',
        amount: expense.amount,
        note: expense.note ?? expense.category ?? 'Expense',
      })
      .select()
      .single()
    fail(error)
    return expenseFrom(data as Row)
  },

  deleteExpense: async (id: string) => {
    const { error } = await supabase.from('expenses').delete().eq('id', id)
    fail(error)
  },
}
