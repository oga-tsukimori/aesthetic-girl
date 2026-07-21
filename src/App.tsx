import * as React from 'react'
import type { Expense, Order, Product, Sale } from '@/data'
import { monthKey, monthlyBooks, uid } from '@/lib/shop'
import { api, loadSnapshot, type AccessRole, type OrderInput, type Snapshot } from '@/lib/api'
import { Segmented } from '@/components/bits'
import Overview from '@/components/Overview'
import Products from '@/components/Products'
import SalesView, { type OrderPatch } from '@/components/Sales'
import ExpensesView from '@/components/Expenses'
import OrderForm from '@/components/OrderForm'
import UserManagement from '@/components/UserManagement'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { LogOut, RefreshCw, Settings } from 'lucide-react'
import { supabase, supabaseConfigured } from '@/lib/supabase'

type Tab = 'overview' | 'products' | 'sales' | 'expenses'

function guessCat(name: string, products: Product[]) {
  const t = new Set(name.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean))
  let best = 'Other', score = 0
  for (const p of products) {
    const pt = new Set(p.name.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean))
    const ov = [...t].filter((x) => pt.has(x)).length / Math.max(1, new Set([...t, ...pt]).size)
    if (ov > score) { best = p.category; score = ov }
  }
  return score >= 0.3 ? best : 'Other'
}

export default function App() {
  const [tab, setTab] = React.useState<Tab>('overview')
  const [ready, setReady] = React.useState(false)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [online, setOnline] = React.useState(false)
  const [products, setProducts] = React.useState<Product[]>([])
  const [sales, setSales] = React.useState<Sale[]>([])
  const [expenses, setExpenses] = React.useState<Expense[]>([])
  const [, setOrders] = React.useState<Order[]>([])
  const [selling, setSelling] = React.useState<Product | null>(null)
  const [orderOpen, setOrderOpen] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [formError, setFormError] = React.useState<string | null>(null)
  const [toast, setToast] = React.useState<string | null>(null)
  const [month, setMonth] = React.useState('2026-07')
  const [role, setRole] = React.useState<AccessRole>('guest')
  const [settingsOpen, setSettingsOpen] = React.useState(false)

  React.useEffect(() => {
    let alive = true
    loadSnapshot()
      .then((snap: Snapshot) => {
        if (!alive) return
        setProducts(snap.products)
        setSales(snap.sales)
        setExpenses(snap.expenses)
        setOrders(snap.orders)
        setRole(snap.role)
        const ks = monthlyBooks(snap.sales, snap.expenses).map((b) => b.key)
        setMonth(ks[ks.length - 1] ?? '2026-07')
        import('@/lib/api').then((m) => alive && setOnline(m.online))
        setReady(true)
      })
      .catch((error: unknown) => {
        if (!alive) return
        setLoadError(error instanceof Error ? error.message : 'Could not open the shop database')
        setReady(true)
      })
    return () => { alive = false }
  }, [])

  const books = React.useMemo(() => monthlyBooks(sales, expenses), [sales, expenses])
  const monthKeys = React.useMemo(() => books.map((b) => b.key), [books])

  React.useEffect(() => {
    if (monthKeys.length && !monthKeys.includes(month)) setMonth(monthKeys[monthKeys.length - 1])
  }, [monthKeys, month])

  const say = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2800)
  }

  const outCount = products.filter((p) => p.qty === 0).length
  const canEdit = role !== 'guest'
  const canSeeExpenses = role !== 'staff'
  const canEditExpenses = role === 'super_admin'
  const tabs: { value: Tab; label: string }[] = [
    { value: 'overview', label: 'Overview' },
    { value: 'products', label: 'Products' },
    { value: 'sales', label: 'Sales' },
    ...(canSeeExpenses ? [{ value: 'expenses' as const, label: 'Expenses' }] : []),
  ]

  React.useEffect(() => {
    if (!canSeeExpenses && tab === 'expenses') setTab('overview')
  }, [canSeeExpenses, tab])

  /* ---- writes: hit the API when it's up, otherwise apply locally ---- */

  const submitOrder = async (o: OrderInput) => {
    if (!canEdit) return
    setSaving(true)
    setFormError(null)
    try {
      if (online) {
        const { sales: created } = await api.createOrder(o)
        setSales((xs) => [...xs, ...created])
        if (o.fulfilment === 'instock') {
          setProducts((ps) =>
            ps.map((p) => {
              const line = o.items.find((i) => i.productId === p.id)
              return line ? { ...p, qty: Math.max(0, p.qty - line.qty) } : p
            })
          )
        }
      } else {
        const orderId = uid()
        const created: Sale[] = o.items.map((l) => {
          const p = l.productId ? products.find((x) => x.id === l.productId) : null
          return {
            id: uid(), orderId, date: o.date, item: l.item, qty: l.qty, unit: l.unit,
            total: l.qty * l.unit, note: o.note || null,
            cat: p ? p.category : guessCat(l.item, products),
            customer: o.customer || null, phone: o.phone || null, address: o.address || null,
            fulfilment: o.fulfilment, payment: o.payment,
          }
        })
        setSales((xs) => [...xs, ...created])
        if (o.fulfilment === 'instock') {
          setProducts((ps) =>
            ps.map((p) => {
              const line = o.items.find((i) => i.productId === p.id)
              return line ? { ...p, qty: Math.max(0, p.qty - line.qty) } : p
            })
          )
        }
      }
      setMonth(monthKey(o.date))
      setOrderOpen(false)
      setSelling(null)
      const count = o.items.reduce((t, i) => t + i.qty, 0)
      say(`Order recorded — ${count} ${count === 1 ? 'item' : 'items'}${o.customer ? ` for ${o.customer}` : ''}`)
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Could not save the order')
    } finally {
      setSaving(false)
    }
  }

  const productActions = {
    create: async (p: Omit<Product, 'id'>) => {
      if (!canEdit) return
      if (online) {
        const saved = await api.createProduct(p)
        setProducts((ps) => [saved, ...ps])
      } else setProducts((ps) => [{ ...p, id: uid() }, ...ps])
    },
    update: async (id: string, patch: Partial<Product>) => {
      if (!canEdit) return
      setProducts((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)))
      if (online) await api.updateProduct(id, patch).catch(() => {})
    },
    adjust: async (id: string, by: number) => {
      if (!canEdit) return
      setProducts((ps) => ps.map((p) => (p.id === id ? { ...p, qty: Math.max(0, p.qty + by) } : p)))
      if (online) await api.adjustProduct(id, by).catch(() => {})
    },
    remove: async (id: string) => {
      if (!canEdit) return
      setProducts((ps) => ps.filter((p) => p.id !== id))
      if (online) await api.deleteProduct(id).catch(() => {})
    },
  }

  if (!ready) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <p className="text-[14px] font-semibold text-black/35">Opening the books…</p>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-4">
        <div className="card-soft w-full max-w-[430px] p-7 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-red-50 text-red-500">
            <RefreshCw className="h-5 w-5" />
          </div>
          <h1 className="mt-4 text-[19px] font-extrabold">Could not load your shop</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-black/50">{loadError}</p>
          <div className="mt-5 flex justify-center gap-2">
            <button className="rounded-xl bg-[#89288F] px-4 py-2 text-[12px] font-bold text-white" onClick={() => window.location.reload()}>
              Try again
            </button>
            {supabaseConfigured && (
              <button className="rounded-xl bg-black/[.05] px-4 py-2 text-[12px] font-bold" onClick={() => supabase.auth.signOut()}>
                Sign out
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="glass sticky top-0 z-30 border-b border-black/[.06]">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <img
              src="/aesthetic-girl-mark.jpg"
              alt="Aesthetic Girl"
              className="h-9 w-9 shrink-0 rounded-[12px] object-cover shadow-sm ring-1 ring-[#89288F]/15"
            />
            <div className="min-w-0 leading-tight">
              <div className="flex items-center gap-2">
                <span className="truncate text-[15.5px] font-extrabold tracking-tight">Aesthetic Girl</span>
                <span
                  className="rounded-full px-2 py-[2px] text-[10px] font-bold uppercase tracking-wide"
                  style={{
                    background: online ? '#E6F6F0' : '#F2F2F5',
                    color: online ? '#0F7B62' : '#8A8A93',
                  }}
                  title={online ? 'Synced securely with Supabase' : 'Database unavailable — changes stay in this tab'}
                >
                  {online ? 'live' : 'offline'}
                </span>
              </div>
              <div className="text-[11.5px] font-semibold text-black/35">
                {products.length} variants · {outCount} out of stock
              </div>
            </div>
          </div>
          <div className="order-3 w-full min-w-0 overflow-x-auto sm:order-none sm:ml-auto sm:w-auto">
            <Segmented
              value={tab}
              onChange={setTab}
              options={tabs}
            />
          </div>
          {supabaseConfigured && (
            <div className="order-2 flex items-center gap-1.5 sm:order-none">
              {role === 'super_admin' && (
                <button
                  aria-label="Open settings"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#89288F]/10 text-[#89288F] transition-colors hover:bg-[#89288F]/15"
                  onClick={() => setSettingsOpen(true)}
                  title="Settings"
                  type="button"
                >
                  <Settings className="h-4 w-4" />
                </button>
              )}
              <button
                aria-label="Sign out"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-black/[.04] text-black/45 transition-colors hover:bg-black/[.08] hover:text-black/70"
                onClick={() => supabase.auth.signOut()}
                title="Sign out"
                type="button"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-[1180px] px-4 py-5 sm:px-6 sm:py-7">
        {tab === 'overview' && (
          <Overview products={products} sales={sales} expenses={expenses}
            onGoRestock={() => setTab('products')} />
        )}
        {tab === 'products' && <Products products={products} actions={productActions} readOnly={!canEdit} />}
        {tab === 'sales' && (
          <SalesView
            sales={sales}
            expenses={expenses}
            monthKeys={monthKeys}
            month={month}
            setMonth={setMonth}
            readOnly={!canEdit}
            onRecord={() => { setFormError(null); setSelling(null); setOrderOpen(true) }}
            onDelete={async (id) => {
              setSales((xs) => xs.filter((s) => s.id !== id))
              if (online) await api.deleteSale(id).catch(() => {})
              say('Line removed')
            }}
            onDeleteOrder={async (orderId) => {
              const gone = sales.filter((s) => s.orderId === orderId)
              setSales((xs) => xs.filter((s) => s.orderId !== orderId))
              if (gone[0]?.fulfilment !== 'preorder') {
                setProducts((ps) =>
                  ps.map((p) => {
                    const back = gone
                      .filter((s) => s.item.toLowerCase() === p.name.toLowerCase())
                      .reduce((t, s) => t + s.qty, 0)
                    return back ? { ...p, qty: p.qty + back } : p
                  })
                )
              }
              if (online) await api.deleteOrder(orderId).catch(() => {})
              say('Order deleted')
            }}
            onEditOrder={async (orderId, patch: OrderPatch) => {
              setSales((xs) =>
                xs.map((s) =>
                  s.orderId === orderId
                    ? {
                        ...s,
                        customer: patch.customer || null,
                        phone: patch.phone || null,
                        address: patch.address || null,
                        date: patch.date,
                        fulfilment: patch.fulfilment,
                        payment: patch.payment,
                      }
                    : s
                )
              )
              if (online) await api.updateOrder(orderId, patch).catch(() => {})
              say('Order updated')
            }}
          />
        )}
        {canSeeExpenses && tab === 'expenses' && (
          <ExpensesView
            expenses={expenses}
            sales={sales}
            monthKeys={monthKeys}
            month={month}
            setMonth={setMonth}
            readOnly={!canEditExpenses}
            onAdd={async (e) => {
              if (!canEditExpenses) return
              if (online) {
                const saved = await api.createExpense(e)
                setExpenses((xs) => [...xs, saved])
              } else setExpenses((xs) => [...xs, { ...e, id: uid() } as Expense])
            }}
            onDelete={async (id) => {
              if (!canEditExpenses) return
              setExpenses((xs) => xs.filter((x) => x.id !== id))
              if (online) await api.deleteExpense(id).catch(() => {})
            }}
          />
        )}
      </main>

      <Dialog open={canEdit && orderOpen} onOpenChange={(o) => { setOrderOpen(o); if (!o) { setSelling(null); setFormError(null) } }}>
        <DialogContent className="max-h-[88vh] overflow-y-auto rounded-[26px] border-none p-6 sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="text-[20px] font-extrabold tracking-tight">Record an order</DialogTitle>
          </DialogHeader>
          <div className="mt-1">
            <OrderForm
              key={selling?.id ?? 'blank'}
              products={products}
              preset={selling}
              busy={saving}
              error={formError}
              onSave={submitOrder}
              onCancel={() => { setOrderOpen(false); setSelling(null); setFormError(null) }}
            />
          </div>
        </DialogContent>
      </Dialog>

      {role === 'super_admin' && (
        <UserManagement open={settingsOpen} onOpenChange={setSettingsOpen} />
      )}

      {toast && (
        <div className="fadeup fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[#1D1D1F] px-5 py-3 text-[13.5px] font-bold text-white shadow-[0_12px_30px_-10px_rgba(0,0,0,.6)]">
          {toast}
        </div>
      )}
    </div>
  )
}
