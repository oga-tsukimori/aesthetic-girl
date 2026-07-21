import * as React from 'react'
import type { Expense, Product, Sale } from '@/data'
import {
  categoryRevenue, compact, expenseByCategory, expTint, inventoryValue, kyat, monthLabel,
  monthlyBooks, prettyDate, statusOf, tint, topSellers, TODAY,
} from '@/lib/shop'
import { CategoryChip, MonthYearPicker, Stat, StockNumber } from './bits'

type Book = { key: string; revenue: number; spend: number; net: number; units: number; orders: number }

/* ---------------- Monthly mode: one month, with the run of months beneath ---------------- */


function useWidth<T extends HTMLElement>() {
  const ref = React.useRef<T | null>(null)
  const [w, setW] = React.useState(720)
  React.useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

/** Monthly sales, stacked as expenses + net so every bar totals that month's sales. */
function MonthChart({
  months, active, onPick,
}: { months: Book[]; active: number; onPick: (i: number) => void }) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const peak = Math.max(...months.map((m) => m.revenue), 1)
  const H = 168

  // round the axis up to a friendly number
  const step = Math.pow(10, Math.floor(Math.log10(peak)))
  const top = Math.ceil(peak / (step / 2)) * (step / 2)
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * top)

  // thin the labels out when the months don't all fit
  const perLabel = 44
  const every = Math.max(1, Math.ceil(months.length / Math.max(1, Math.floor(width / perLabel))))

  return (
    <div ref={ref}>
      <div className="flex gap-2.5">
        <div className="relative w-[42px] shrink-0" style={{ height: H }}>
          {ticks.map((t) => (
            <span
              key={t}
              className="num absolute right-0 -translate-y-1/2 text-[10px] font-bold text-black/25"
              style={{ top: `${(1 - t / top) * 100}%` }}
            >
              {t === 0 ? '0' : compact(t)}
            </span>
          ))}
        </div>

        <div className="relative min-w-0 flex-1">
          <div className="absolute inset-0" aria-hidden>
            {ticks.map((t) => (
              <span
                key={t}
                className="absolute left-0 right-0 border-t border-dashed border-black/[.07]"
                style={{ top: `${(1 - t / top) * 100}%` }}
              />
            ))}
          </div>

          <div className="relative flex items-end gap-[3px]" style={{ height: H }} role="list">
            {months.map((m, i) => {
              const on = i === active
              const netH = (Math.max(0, m.net) / top) * H
              const spendH = (m.spend / top) * H
              return (
                <button
                  key={m.key}
                  role="listitem"
                  onClick={() => onPick(i)}
                  title={`${monthLabel(m.key)} — ${kyat(m.revenue)} sales, ${kyat(m.spend)} expenses`}
                  aria-label={`${monthLabel(m.key)}: ${kyat(m.revenue)} sales`}
                  className="tap group relative flex min-w-0 flex-1 flex-col justify-end rounded-t-[5px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B8A]"
                  style={{ height: H }}
                >
                  <span
                    className="w-full rounded-t-[5px] transition-all duration-300"
                    style={{ height: netH, background: on ? '#FF6B8A' : '#F3C4D0' }}
                  />
                  <span
                    className="w-full transition-all duration-300"
                    style={{ height: spendH, background: on ? '#8B7BEC' : '#D6CFF6' }}
                  />
                  <span
                    className="num pointer-events-none absolute inset-x-0 -top-[3px] text-center text-[9.5px] font-bold text-black/45 opacity-0 transition group-hover:opacity-100"
                    style={{ bottom: netH + spendH + 4, top: 'auto' }}
                  >
                    {compact(m.revenue)}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="mt-2 flex gap-[3px] pl-[52px]">
        {months.map((m, i) => (
          <span
            key={m.key}
            className={`min-w-0 flex-1 truncate text-center text-[10px] font-bold ${
              i === active ? 'text-[#FF6B8A]' : 'text-black/30'
            }`}
          >
            {i % every === 0 || i === active ? monthLabel(m.key) : ''}
          </span>
        ))}
      </div>
    </div>
  )
}

function MonthlyPanel({
  months, active, setActive,
}: { months: Book[]; active: number; setActive: (i: number) => void }) {
  const shown = months[active]
  const prev = months[active - 1]
  const delta = prev && prev.revenue ? ((shown.revenue - prev.revenue) / prev.revenue) * 100 : null
  const keys = months.map((m) => m.key)

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 sm:px-7 sm:pt-6">
        <div>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-[13px] font-bold uppercase tracking-[.08em] text-black/35">
              {monthLabel(shown.key)} revenue
            </span>
            {delta !== null && (
              <span
                className="num rounded-full px-2 py-[3px] text-[12px] font-bold"
                style={{
                  background: delta >= 0 ? '#E6F6F0' : '#FFECEC',
                  color: delta >= 0 ? '#0F7B62' : '#E5484D',
                }}
              >
                {delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(0)}% vs {monthLabel(prev!.key)}
              </span>
            )}
          </div>
          <div className="num mt-1 flex items-end gap-2 text-[clamp(38px,9vw,60px)] font-extrabold leading-[1.02] tracking-[-.045em] text-[#1D1D1F]">
            {shown.revenue.toLocaleString('en-US')}
            <span className="mb-2 text-[18px] font-bold tracking-normal text-black/30">Ks</span>
          </div>
          <div className="mt-1 text-[13.5px] font-medium text-black/45">
            {shown.orders} orders · {shown.units} items sold ·{' '}
            {shown.orders ? `avg ${kyat(Math.round(shown.revenue / shown.orders))} per order` : 'no sales'}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] font-bold">
            <span className="text-black/35">less {compact(shown.spend)} Ks expenses →</span>
            <span
              className="num rounded-full px-2.5 py-[3px]"
              style={{
                background: shown.net >= 0 ? '#E6F6F0' : '#FFECEC',
                color: shown.net >= 0 ? '#0F7B62' : '#E5484D',
              }}
            >
              {kyat(shown.net)} net
            </span>
          </div>
        </div>

        <MonthYearPicker
          value={shown.key}
          keys={keys}
          onChange={(k) => setActive(Math.max(0, keys.indexOf(k)))}
        />
      </div>

      <div className="mt-5 px-5 pb-5 sm:px-7 sm:pb-6">
        <MonthChart months={months} active={active} onPick={setActive} />
      </div>
    </>
  )
}

/* ---------------- Compare mode: pick any months, read them side by side ---------------- */

function ComparePanel({ months }: { months: Book[] }) {
  const [picked, setPicked] = React.useState<string[]>(() =>
    months.slice(-3).map((m) => m.key)
  )
  const toggle = (k: string) =>
    setPicked((ps) => (ps.includes(k) ? ps.filter((x) => x !== k) : [...ps, k]))

  const rows = months.filter((m) => picked.includes(m.key))
  const peak = Math.max(...rows.map((r) => Math.max(r.revenue, r.spend)), 1)
  const best = rows.length ? Math.max(...rows.map((r) => r.net)) : 0
  const totals = rows.reduce(
    (t, r) => ({ revenue: t.revenue + r.revenue, spend: t.spend + r.spend, net: t.net + r.net, orders: t.orders + r.orders }),
    { revenue: 0, spend: 0, net: 0, orders: 0 }
  )

  return (
    <div className="px-5 pb-5 pt-5 sm:px-7 sm:pb-6">
      <p className="text-[12.5px] font-semibold text-black/40">
        Pick the months you want side by side.
      </p>
      <div className="no-bar -mx-1 mt-2.5 flex gap-2 overflow-x-auto px-1 pb-1">
        {months.map((m) => {
          const on = picked.includes(m.key)
          return (
            <button
              key={m.key}
              onClick={() => toggle(m.key)}
              aria-pressed={on}
              className={`tap shrink-0 rounded-full px-3.5 py-[7px] text-[12.5px] font-bold transition ${
                on ? 'bg-[#1D1D1F] text-white' : 'bg-black/[.05] text-black/50 hover:bg-black/[.08]'
              }`}
            >
              {on ? '✓ ' : ''}{monthLabel(m.key)}
            </button>
          )
        })}
      </div>

      {rows.length === 0 ? (
        <p className="mt-8 text-center text-[14px] font-semibold text-black/35">
          Choose at least one month above.
        </p>
      ) : (
        <>
          <div className="mt-5 space-y-4">
            {rows.map((r) => (
              <div key={r.key}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="text-[14px] font-extrabold text-[#1D1D1F]">
                    {monthLabel(r.key)}
                    {rows.length > 1 && r.net === best && (
                      <span className="ml-2 rounded-full bg-[#E6F6F0] px-2 py-[2px] text-[10.5px] font-bold uppercase tracking-wide text-[#0F7B62]">
                        best net
                      </span>
                    )}
                  </span>
                  <span className="num text-[13px] font-bold" style={{ color: r.net >= 0 ? '#0F7B62' : '#E5484D' }}>
                    {kyat(r.net)} net
                  </span>
                </div>

                <div className="mt-2 space-y-1.5">
                  <div className="flex items-center gap-2.5">
                    <span className="w-[62px] shrink-0 text-[11px] font-bold text-black/35">Sales</span>
                    <div className="h-[16px] flex-1 rounded-full bg-black/[.04]">
                      <div
                        className="flex h-full items-center justify-end rounded-full bg-[#FF6B8A] pr-2 transition-all duration-500"
                        style={{ width: `${Math.max(6, (r.revenue / peak) * 100)}%` }}
                      >
                        <span className="num text-[10.5px] font-bold text-white">{compact(r.revenue)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="w-[62px] shrink-0 text-[11px] font-bold text-black/35">Expenses</span>
                    <div className="h-[16px] flex-1 rounded-full bg-black/[.04]">
                      <div
                        className="flex h-full items-center justify-end rounded-full bg-[#B9A9FF] pr-2 transition-all duration-500"
                        style={{ width: `${Math.max(r.spend ? 6 : 0, (r.spend / peak) * 100)}%` }}
                      >
                        {r.spend > 0 && (
                          <span className="num text-[10.5px] font-bold text-white">{compact(r.spend)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-1.5 text-[11.5px] font-semibold text-black/35">
                  {r.orders} orders · {r.units} items ·{' '}
                  {r.revenue ? `${((r.net / r.revenue) * 100).toFixed(0)}% margin` : 'no sales'}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-[18px] bg-[#F7F7FA] px-4 py-3.5">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[.06em] text-black/35">
                {rows.length} months combined
              </div>
              <div className="num text-[19px] font-extrabold" style={{ color: totals.net >= 0 ? '#0F7B62' : '#E5484D' }}>
                {kyat(totals.net)} net
              </div>
            </div>
            <div className="ml-auto flex gap-5 text-right">
              <div>
                <div className="num text-[15px] font-extrabold">{compact(totals.revenue)}</div>
                <div className="text-[11px] font-semibold text-black/40">sales</div>
              </div>
              <div>
                <div className="num text-[15px] font-extrabold">{compact(totals.spend)}</div>
                <div className="text-[11px] font-semibold text-black/40">expenses</div>
              </div>
              <div>
                <div className="num text-[15px] font-extrabold">
                  {compact(Math.round(totals.revenue / rows.length))}
                </div>
                <div className="text-[11px] font-semibold text-black/40">avg / month</div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/* ---------------- Page ---------------- */

export default function Overview({
  products, sales, expenses, onGoRestock,
}: { products: Product[]; sales: Sale[]; expenses: Expense[]; onGoRestock: () => void }) {
  const months = React.useMemo(() => monthlyBooks(sales, expenses), [sales, expenses])
  const [mode, setMode] = React.useState<'monthly' | 'compare'>('monthly')
  const [active, setActive] = React.useState(months.length - 1)

  React.useEffect(() => {
    if (active > months.length - 1) setActive(months.length - 1)
  }, [months.length, active])

  const total = sales.reduce((t, s) => t + s.total, 0)
  const totalSpend = expenses.reduce((t, e) => t + e.amount, 0)
  const units = sales.reduce((t, s) => t + s.qty, 0)
  const spendCats = React.useMemo(() => expenseByCategory(expenses), [expenses])
  const cats = React.useMemo(() => categoryRevenue(sales), [sales])
  const top = React.useMemo(() => topSellers(sales), [sales])
  const restock = products.filter((p) => statusOf(p.qty) !== 'in').sort((a, b) => a.qty - b.qty)
  const catMax = cats[0]?.revenue ?? 1

  return (
    <div className="space-y-5">
      <section className="card-soft fadeup overflow-hidden">
        <div className="flex items-center justify-between border-b border-black/[.055] px-5 py-3 sm:px-7">
          <div className="inline-flex rounded-full bg-black/[.055] p-[3px]" role="tablist">
            {([['monthly', 'Monthly'], ['compare', 'Compare']] as const).map(([k, label]) => (
              <button
                key={k}
                role="tab"
                aria-selected={mode === k}
                onClick={() => setMode(k)}
                className={`tap rounded-full px-4 py-[7px] text-[13px] font-semibold ${
                  mode === k ? 'bg-white text-[#1D1D1F] shadow-[0_1px_3px_rgba(0,0,0,.12)]' : 'text-black/45'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 text-[11.5px] font-bold text-black/35">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-[3px] bg-[#FF6B8A]" /> sales
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-[3px] bg-[#B9A9FF]" /> expenses
            </span>
          </div>
        </div>

        {mode === 'monthly'
          ? <MonthlyPanel months={months} active={active} setActive={setActive} />
          : <ComparePanel months={months} />}
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="All-time revenue" value={compact(total) + ' Ks'} sub={`${sales.length} sales logged`} />
        <Stat
          label="All-time net"
          value={compact(total - totalSpend) + ' Ks'}
          sub={`${compact(totalSpend)} Ks expenses · ${units.toLocaleString('en-US')} items sold`}
          accent={total - totalSpend >= 0 ? '#0F7B62' : '#E5484D'}
        />
        <Stat
          label="Stock on hand"
          value={compact(inventoryValue(products)) + ' Ks'}
          sub={`${products.reduce((t, p) => t + Math.max(0, p.qty), 0)} units in ${products.length} lines`}
        />
        <Stat
          label="Needs restock"
          value={String(restock.length)}
          sub={`${restock.filter((p) => p.qty === 0).length} fully out`}
          accent={restock.length ? '#E5484D' : undefined}
        />
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
        <section className="card-soft fadeup p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-[17px] font-extrabold tracking-tight">Restock soon</h2>
            <button
              onClick={onGoRestock}
              className="tap text-[13px] font-bold text-[#FF6B8A] hover:underline focus-visible:outline-none"
            >
              Open products
            </button>
          </div>
          <ul className="mt-3 divide-y divide-black/[.06]">
            {restock.slice(0, 8).map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-2.5">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: tint(p.category).dot }} />
                <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-black/80">{p.name}</span>
                <CategoryChip cat={p.category} className="hidden sm:inline-flex" />
                <div className="w-[86px] shrink-0 text-right"><StockNumber qty={p.qty} /></div>
              </li>
            ))}
          </ul>
          {restock.length > 8 && (
            <p className="mt-3 text-[12.5px] font-medium text-black/40">
              +{restock.length - 8} more running low
            </p>
          )}
        </section>

        <section className="card-soft fadeup p-5 sm:p-6">
          <h2 className="text-[17px] font-extrabold tracking-tight">Revenue by category</h2>
          <ul className="mt-4 space-y-3">
            {cats.slice(0, 7).map((c) => (
              <li key={c.cat}>
                <div className="flex items-baseline justify-between">
                  <span className="text-[13.5px] font-semibold text-black/70">{c.cat}</span>
                  <span className="num text-[13px] font-bold text-black/45">{compact(c.revenue)} Ks</span>
                </div>
                <div className="mt-1.5 h-[7px] rounded-full bg-black/[.05]">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${(c.revenue / catMax) * 100}%`, background: tint(c.cat).dot }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {spendCats.length > 0 && (
        <section className="card-soft fadeup p-5 sm:p-6">
          <h2 className="text-[17px] font-extrabold tracking-tight">Expenses by type</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {spendCats.map((c) => (
              <div key={c.category} className="rounded-[18px] bg-[#F7F7FA] p-4">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: expTint(c.category) }} />
                  <span className="text-[13.5px] font-bold text-black/70">{c.category}</span>
                </div>
                <div className="num mt-1.5 text-[19px] font-extrabold" style={{ color: expTint(c.category) }}>
                  {compact(c.amount)} Ks
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="card-soft fadeup p-5 sm:p-6">
        <h2 className="text-[17px] font-extrabold tracking-tight">Best sellers by revenue</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {top.map((t, i) => (
            <div key={t.name} className="rounded-[18px] bg-[#F7F7FA] p-4">
              <div className="flex items-start justify-between gap-2">
                <span className="line-clamp-2 text-[14px] font-bold capitalize leading-snug text-black/80">
                  {t.name}
                </span>
                <span className="num shrink-0 text-[12px] font-extrabold text-black/25">#{i + 1}</span>
              </div>
              <div className="num mt-2 text-[19px] font-extrabold" style={{ color: tint(t.cat).fg }}>
                {compact(t.revenue)} Ks
              </div>
              <div className="text-[12px] font-semibold text-black/40">{t.units} sold</div>
            </div>
          ))}
        </div>
      </section>

      <p className="pb-2 text-center text-[12px] font-medium text-black/30">
        Books current through {prettyDate(TODAY)}
      </p>
    </div>
  )
}
