import type { Expense, Product, Sale } from '@/data'

export const TODAY = '2026-07-21'

export const CATEGORY_TINT: Record<string, { bg: string; fg: string; dot: string }> = {
  'iPad Cover': { bg: '#FFEFF3', fg: '#C2185B', dot: '#FF6B8A' },
  'Screen Protector': { bg: '#E8F7F2', fg: '#0F7B62', dot: '#34C7A5' },
  'Pen & Accessories': { bg: '#FFF4E0', fg: '#9A6100', dot: '#FFB020' },
  'Keyboard Case': { bg: '#EAF3FF', fg: '#1462A8', dot: '#5AA9FA' },
  'Nib & Cover': { bg: '#F1EEFF', fg: '#5546B8', dot: '#8B7BEC' },
  'Drawing Tablet': { bg: '#FFEDE8', fg: '#B23C1A', dot: '#FF8556' },
  Mouse: { bg: '#EDF7E4', fg: '#4A7A17', dot: '#8CC63F' },
  Bag: { bg: '#FFF0F6', fg: '#A0407A', dot: '#F07CB8' },
  Audio: { bg: '#E7F5FA', fg: '#0B6C87', dot: '#43BEDC' },
  Other: { bg: '#F2F2F5', fg: '#54545C', dot: '#A5A5AE' },
}

export const tint = (c: string) => CATEGORY_TINT[c] ?? CATEGORY_TINT.Other

export type Status = 'out' | 'low' | 'in'

export const statusOf = (qty: number): Status =>
  qty <= 0 ? 'out' : qty <= 3 ? 'low' : 'in'

export const STATUS_META: Record<Status, { label: string; color: string; bg: string }> = {
  out: { label: 'Out of stock', color: '#E5484D', bg: '#FFECEC' },
  low: { label: 'Low stock', color: '#B26A00', bg: '#FFF3DC' },
  in: { label: 'In stock', color: '#0F7B62', bg: '#E6F6F0' },
}

export const kyat = (n: number) => n.toLocaleString('en-US') + ' Ks'

export const compact = (n: number) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n >= 10_000_000 ? 1 : 2) + 'M'
  if (n >= 1_000) return Math.round(n / 1_000) + 'K'
  return String(n)
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export const monthKey = (iso: string) => iso.slice(0, 7)

export const monthLabel = (key: string) => {
  const [y, m] = key.split('-')
  return `${MONTHS[Number(m) - 1]} ${y.slice(2)}`
}

export const prettyDate = (iso: string) => {
  const [y, m, d] = iso.split('-')
  return `${Number(d)} ${MONTHS[Number(m) - 1]} ${y}`
}

export function monthlyRevenue(sales: Sale[]) {
  const map = new Map<string, { revenue: number; units: number; orders: number }>()
  for (const s of sales) {
    const k = monthKey(s.date)
    const cur = map.get(k) ?? { revenue: 0, units: 0, orders: 0 }
    cur.revenue += s.total
    cur.units += s.qty
    cur.orders += 1
    map.set(k, cur)
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([key, v]) => ({ key, ...v }))
}

export function categoryRevenue(sales: Sale[]) {
  const map = new Map<string, number>()
  for (const s of sales) map.set(s.cat, (map.get(s.cat) ?? 0) + s.total)
  return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([cat, revenue]) => ({ cat, revenue }))
}

export function topSellers(sales: Sale[], limit = 6) {
  const map = new Map<string, { revenue: number; units: number; cat: string }>()
  for (const s of sales) {
    const key = s.item.toLowerCase().trim()
    const cur = map.get(key) ?? { revenue: 0, units: 0, cat: s.cat }
    cur.revenue += s.total
    cur.units += s.qty
    map.set(key, cur)
  }
  return [...map.entries()]
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, limit)
    .map(([name, v]) => ({ name, ...v }))
}

export function inventoryValue(products: Product[]) {
  return products.reduce((t, p) => t + (p.price ?? 0) * Math.max(0, p.qty), 0)
}

export const uid = () => Math.random().toString(36).slice(2, 10)

export const EXPENSE_TINT: Record<string, string> = {
  'Product stock': '#7C6BEC',
  Cargo: '#2F9BD8',
  'Boost / ads': '#FF8556',
  Staff: '#2FA98A',
  Other: '#9A9AA4',
}

export const expTint = (c: string) => EXPENSE_TINT[c] ?? EXPENSE_TINT.Other

/** Every month that has either a sale or an expense, with the net for that month. */
export function monthlyBooks(sales: Sale[], expenses: Expense[]) {
  const map = new Map<string, { revenue: number; spend: number; units: number; orders: number }>()
  const get = (k: string) => {
    const cur = map.get(k) ?? { revenue: 0, spend: 0, units: 0, orders: 0 }
    map.set(k, cur)
    return cur
  }
  for (const s of sales) {
    const c = get(monthKey(s.date))
    c.revenue += s.total
    c.units += s.qty
    c.orders += 1
  }
  for (const e of expenses) get(monthKey(e.date)).spend += e.amount
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, v]) => ({ key, ...v, net: v.revenue - v.spend }))
}

export function expenseByCategory(expenses: Expense[]) {
  const map = new Map<string, number>()
  for (const e of expenses) map.set(e.category, (map.get(e.category) ?? 0) + e.amount)
  return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([category, amount]) => ({ category, amount }))
}

export const YEARS_OF = (keys: string[]) =>
  [...new Set(keys.map((k) => k.slice(0, 4)))].sort((a, b) => b.localeCompare(a))

export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']
