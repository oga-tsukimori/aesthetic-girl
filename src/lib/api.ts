import type { Expense, Order, Product, Sale } from '@/data'
import { SEED_EXPENSES, SEED_PRODUCTS, SEED_SALES } from '@/data'

/**
 * Talks to the Express API in `server/`. If that isn't running — which is the
 * case when this file is opened as a standalone build — everything falls back
 * to the spreadsheet data held in memory, so the UI stays usable either way.
 */
const BASE =
  (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_URL ?? 'http://localhost:4000'

export type Snapshot = { products: Product[]; sales: Sale[]; expenses: Expense[]; orders: Order[] }

export let online = false

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error || `Request failed (${res.status})`)
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T)
}

/** Try the API once at boot; fall back to seed data when it isn't reachable. */
export async function loadSnapshot(): Promise<Snapshot> {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 2500)
    const res = await fetch(BASE + '/api/snapshot', { signal: ctrl.signal })
    clearTimeout(timer)
    if (!res.ok) throw new Error('bad status')
    online = true
    return (await res.json()) as Snapshot
  } catch {
    online = false
    return { products: SEED_PRODUCTS, sales: SEED_SALES, expenses: SEED_EXPENSES, orders: [] }
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
  createProduct: (p: Partial<Product>) => call<Product>('/api/products', { method: 'POST', body: JSON.stringify(p) }),
  updateProduct: (id: string, p: Partial<Product>) =>
    call<Product>(`/api/products/${id}`, { method: 'PATCH', body: JSON.stringify(p) }),
  adjustProduct: (id: string, by: number) =>
    call<Product>(`/api/products/${id}/adjust`, { method: 'POST', body: JSON.stringify({ by }) }),
  deleteProduct: (id: string) => call<void>(`/api/products/${id}`, { method: 'DELETE' }),

  createOrder: (o: OrderInput) =>
    call<{ order: Order; sales: Sale[] }>('/api/orders', { method: 'POST', body: JSON.stringify(o) }),
  updateOrder: (id: string, patch: Partial<OrderInput>) =>
    call<Order>(`/api/orders/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteOrder: (id: string) => call<void>(`/api/orders/${id}`, { method: 'DELETE' }),
  deleteSale: (id: string) => call<void>(`/api/sales/${id}`, { method: 'DELETE' }),

  createExpense: (e: Partial<Expense>) =>
    call<Expense>('/api/expenses', { method: 'POST', body: JSON.stringify(e) }),
  deleteExpense: (id: string) => call<void>(`/api/expenses/${id}`, { method: 'DELETE' }),
}
