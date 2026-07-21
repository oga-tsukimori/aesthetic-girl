import * as React from 'react'
import type { Expense, Sale } from '@/data'
import { EXPENSE_CATEGORIES } from '@/data'
import { compact, expTint, kyat, monthKey, monthLabel, monthlyBooks, prettyDate } from '@/lib/shop'
import { EmptyState, GhostButton, MonthYearPicker, PrimaryButton, inputCls } from './bits'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'

const lastDay = (month: string) => {
  const [y, m] = month.split('-').map(Number)
  return `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`
}


/** Expense split as a donut — one ring, one legend, no bars. */
function SpendDonut({
  slices, total, label,
}: { slices: { category: string; amount: number; count: number }[]; total: number; label: string }) {
  const [hot, setHot] = React.useState<string | null>(null)
  const R = 68
  const STROKE = 26
  const C = 2 * Math.PI * R
  let offset = 0
  const arcs = slices.map((s) => {
    const share = total ? s.amount / total : 0
    const arc = { ...s, share, dash: share * C, offset }
    offset += share * C
    return arc
  })
  const focus = arcs.find((a) => a.category === hot)

  return (
    <div className="flex w-full flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-7 lg:gap-10">
      <div className="relative h-[180px] w-[180px] shrink-0">
        <svg width="180" height="180" viewBox="0 0 180 180" role="img" aria-label={`${label} expense split`}>
          <g transform="rotate(-90 90 90)">
            <circle cx="90" cy="90" r={R} fill="none" stroke="rgba(0,0,0,.045)" strokeWidth={STROKE} />
            {arcs.map((a) => (
              <circle
                key={a.category}
                cx="90"
                cy="90"
                r={R}
                fill="none"
                stroke={expTint(a.category)}
                strokeWidth={hot === a.category ? STROKE + 6 : STROKE}
                strokeDasharray={`${Math.max(0, a.dash - 2)} ${C}`}
                strokeDashoffset={-a.offset}
                strokeLinecap="butt"
                opacity={hot && hot !== a.category ? 0.32 : 1}
                onMouseEnter={() => setHot(a.category)}
                onMouseLeave={() => setHot(null)}
                style={{ transition: 'stroke-width .18s ease, opacity .18s ease', cursor: 'pointer' }}
              />
            ))}
          </g>
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          {focus ? (
            <>
              <span className="num text-[20px] font-extrabold leading-none" style={{ color: expTint(focus.category) }}>
                {(focus.share * 100).toFixed(0)}%
              </span>
              <span className="mt-1 max-w-[96px] text-[10.5px] font-bold leading-tight text-black/45">
                {focus.category}
              </span>
            </>
          ) : (
            <>
              <span className="num text-[21px] font-extrabold leading-none text-[#1D1D1F]">{compact(total)}</span>
              <span className="mt-1 text-[10.5px] font-bold uppercase tracking-[.06em] text-black/35">Ks spent</span>
            </>
          )}
        </div>
      </div>

      <ul className="grid w-full min-w-0 flex-1 gap-x-8 gap-y-1 lg:grid-cols-2">
        {arcs.map((a) => (
          <li
            key={a.category}
            onMouseEnter={() => setHot(a.category)}
            onMouseLeave={() => setHot(null)}
            className={`flex items-center gap-2.5 rounded-[12px] px-2.5 py-2 transition ${
              hot === a.category ? 'bg-black/[.035]' : ''
            }`}
          >
            <span className="h-[10px] w-[10px] shrink-0 rounded-full" style={{ background: expTint(a.category) }} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] font-bold text-black/75">{a.category}</span>
              <span className="text-[11.5px] font-medium text-black/35">
                {a.count} {a.count === 1 ? 'entry' : 'entries'}
              </span>
            </span>
            <span className="num shrink-0 text-right">
              <span className="block text-[13px] font-extrabold text-black/75">{kyat(a.amount)}</span>
              <span className="block text-[11.5px] font-bold text-black/30">{(a.share * 100).toFixed(0)}%</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function Expenses({
  expenses, sales, monthKeys, month, setMonth, onAdd, onDelete, readOnly = false,
}: {
  expenses: Expense[]
  sales: Sale[]
  monthKeys: string[]
  month: string
  setMonth: (k: string) => void
  onAdd: (e: Omit<Expense, 'id'>) => void | Promise<void>
  onDelete: (id: string) => void | Promise<void>
  readOnly?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const [category, setCategory] = React.useState<string>('Product stock')
  const [amount, setAmount] = React.useState('')
  const [note, setNote] = React.useState('')
  const [date, setDate] = React.useState(`${month}-01`)

  // the table's own date window — follows the month unless you widen it
  const [from, setFrom] = React.useState(`${month}-01`)
  const [to, setTo] = React.useState(lastDay(month))
  const [scope, setScope] = React.useState<'month' | 'range'>('month')

  React.useEffect(() => {
    setDate(`${month}-01`)
    if (scope === 'month') {
      setFrom(`${month}-01`)
      setTo(lastDay(month))
    }
  }, [month, scope])

  const monthRows = expenses.filter((e) => monthKey(e.date) === month)
  const revenue = sales.filter((s) => monthKey(s.date) === month).reduce((t, s) => t + s.total, 0)
  const spend = monthRows.reduce((t, e) => t + e.amount, 0)
  const net = revenue - spend
  const margin = revenue ? (net / revenue) * 100 : 0

  const byCat = EXPENSE_CATEGORIES.map((c) => {
    const rows = monthRows.filter((e) => e.category === c)
    return {
      category: c as string,
      amount: rows.reduce((t, e) => t + e.amount, 0),
      count: rows.length,
    }
  }).filter((c) => c.amount > 0)

  const books = React.useMemo(() => monthlyBooks(sales, expenses), [sales, expenses])
  const ledger = React.useMemo(
    () =>
      books
        .filter((b) => b.spend > 0)
        .map((b) => {
          const rows = expenses.filter((e) => monthKey(e.date) === b.key)
          const cell = (c: string) => rows.filter((e) => e.category === c).reduce((t, e) => t + e.amount, 0)
          return {
            key: b.key, revenue: b.revenue, net: b.net,
            stock: cell('Product stock'), cargo: cell('Cargo'),
            staff: cell('Staff'), boost: cell('Boost / ads'), other: cell('Other'),
            total: b.spend,
          }
        })
        .reverse(),
    [books, expenses]
  )

  const table = expenses
    .filter((e) => e.date >= from && e.date <= to)
    .sort((a, b) => b.date.localeCompare(a.date) || b.amount - a.amount)
  const tableTotal = table.reduce((t, e) => t + e.amount, 0)

  const save = () => {
    const amt = Number(String(amount).replace(/,/g, ''))
    if (!amt || amt <= 0) return
    onAdd({ date, category, amount: amt, note: note.trim() || category })
    setAmount('')
    setNote('')
    setOpen(false)
  }

  const money = 'num px-3 py-2 text-right text-[12.5px] font-bold tabular-nums'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MonthYearPicker value={month} onChange={setMonth} keys={monthKeys} label="Showing" />
        {!readOnly && <PrimaryButton onClick={() => setOpen(true)}>+ Add expense</PrimaryButton>}
      </div>

      {/* the month's spend, with the rest of the picture beside it */}
      <section className="card-soft fadeup flex flex-wrap items-end justify-between gap-x-8 gap-y-5 p-5 sm:p-6">
        <div className="min-w-0">
          <div className="text-[12.5px] font-bold uppercase tracking-[.07em] text-black/35">
            {monthLabel(month)} total expenses
          </div>
          <div className="num mt-0.5 text-[clamp(34px,7vw,52px)] font-extrabold leading-none tracking-[-.04em] text-[#5546B8]">
            {spend.toLocaleString('en-US')}
            <span className="ml-1.5 text-[16px] font-bold text-black/30">Ks</span>
          </div>
          <div className="mt-2 text-[12.5px] font-semibold text-black/40">
            across {monthRows.length} {monthRows.length === 1 ? 'entry' : 'entries'}
            {byCat.length > 0 && ` · mostly ${byCat[0].category.toLowerCase()}`}
          </div>
        </div>

        <div className="flex flex-wrap gap-x-8 gap-y-4 text-right">
          <div>
            <div className="num text-[20px] font-extrabold text-[#0F7B62]">{compact(revenue)}</div>
            <div className="text-[12px] font-semibold text-black/40">sales</div>
          </div>
          <div>
            <div className="num text-[20px] font-extrabold" style={{ color: net >= 0 ? '#1D1D1F' : '#E5484D' }}>
              {compact(net)}
            </div>
            <div className="text-[12px] font-semibold text-black/40">net</div>
          </div>
          <div>
            <div className="num text-[20px] font-extrabold text-black/70">
              {revenue ? `${margin.toFixed(0)}%` : '—'}
            </div>
            <div className="text-[12px] font-semibold text-black/40">margin</div>
          </div>
          <div>
            <div className="num text-[20px] font-extrabold text-black/70">
              {revenue ? `${((spend / revenue) * 100).toFixed(0)}%` : '—'}
            </div>
            <div className="text-[12px] font-semibold text-black/40">cost ratio</div>
          </div>
        </div>
      </section>

      {/* where the money went, by type */}
      {byCat.length > 0 && (
        <section className="card-soft fadeup p-5 sm:p-6">
          <h2 className="mb-4 text-[16px] font-extrabold tracking-tight">
            {monthLabel(month)} breakdown
          </h2>
          <SpendDonut slices={byCat} total={spend} label={monthLabel(month)} />
        </section>
      )}

      {/* month-by-month ledger */}
      {ledger.length > 0 && (
        <section className="card-soft fadeup overflow-hidden">
          <header className="flex items-baseline justify-between border-b border-black/[.06] px-5 py-3">
            <h2 className="text-[16px] font-extrabold tracking-tight">Cost by month</h2>
            <span className="text-[11.5px] font-semibold text-black/35">{ledger.length} months</span>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse">
              <thead>
                <tr className="border-b border-black/[.06] text-[11px] font-bold uppercase tracking-[.05em] text-black/35">
                  <th className="px-3 py-2 text-left">Month</th>
                  <th className="px-3 py-2 text-right">Sales</th>
                  <th className="px-3 py-2 text-right">Product stock</th>
                  <th className="px-3 py-2 text-right">Cargo</th>
                  <th className="px-3 py-2 text-right">Staff</th>
                  <th className="px-3 py-2 text-right">Boost</th>
                  <th className="px-3 py-2 text-right">Total cost</th>
                  <th className="px-3 py-2 text-right">Net</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((r) => (
                  <tr
                    key={r.key}
                    onClick={() => setMonth(r.key)}
                    className={`tap cursor-pointer border-b border-black/[.04] last:border-0 hover:bg-black/[.02] ${
                      r.key === month ? 'bg-[#FFF3F6]' : ''
                    }`}
                  >
                    <td className="px-3 py-2 text-left text-[12.5px] font-bold text-[#1D1D1F]">
                      {monthLabel(r.key)}
                    </td>
                    <td className={money + ' text-[#0F7B62]'}>{compact(r.revenue)}</td>
                    <td className={money + ' text-black/60'}>{r.stock ? compact(r.stock) : '—'}</td>
                    <td className={money + ' text-black/60'}>{r.cargo ? compact(r.cargo) : '—'}</td>
                    <td className={money + ' text-black/60'}>{r.staff ? compact(r.staff) : '—'}</td>
                    <td className={money + ' text-black/60'}>{r.boost ? compact(r.boost) : '—'}</td>
                    <td className={money + ' text-[#7C6BEC]'}>{compact(r.total)}</td>
                    <td className={money} style={{ color: r.net >= 0 ? '#0F7B62' : '#E5484D' }}>
                      {compact(r.net)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* every entry, as a table you can date-filter */}
      <section className="card-soft fadeup overflow-hidden">
        <header className="flex flex-wrap items-center gap-3 border-b border-black/[.06] px-5 py-3">
          <h2 className="text-[16px] font-extrabold tracking-tight">Expense records</h2>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-full bg-black/[.055] p-[3px]">
              {([['month', 'This month'], ['range', 'Date range']] as const).map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setScope(k)}
                  className={`tap rounded-full px-3 py-[6px] text-[12px] font-bold ${
                    scope === k ? 'bg-white text-[#1D1D1F] shadow-[0_1px_3px_rgba(0,0,0,.12)]' : 'text-black/45'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {scope === 'range' && (
              <div className="flex items-center gap-1.5">
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date"
                  className="rounded-[11px] border border-black/[.09] bg-white px-2.5 py-1.5 text-[12.5px] font-semibold focus:outline-none focus:ring-2 focus:ring-[#89288F]/60" />
                <span className="text-[12px] font-bold text-black/30">→</span>
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date"
                  className="rounded-[11px] border border-black/[.09] bg-white px-2.5 py-1.5 text-[12.5px] font-semibold focus:outline-none focus:ring-2 focus:ring-[#89288F]/60" />
              </div>
            )}
          </div>
        </header>

        {table.length === 0 ? (
          <EmptyState
            title="Nothing in this window"
            body="Widen the dates, or add stock fees, cargo, boosts and staff pay as they come up."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse">
                <thead>
                  <tr className="border-b border-black/[.06] text-[11px] font-bold uppercase tracking-[.05em] text-black/35">
                    <th className="px-4 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-left">Description</th>
                    <th className="px-3 py-2 text-left">Category</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                    <th className="w-9" />
                  </tr>
                </thead>
                <tbody>
                  {table.map((e) => (
                    <tr key={e.id} className="group border-b border-black/[.04] last:border-0 hover:bg-black/[.015]">
                      <td className="num whitespace-nowrap px-4 py-2.5 text-left text-[12.5px] font-semibold text-black/50">
                        {prettyDate(e.date)}
                      </td>
                      <td className="px-3 py-2.5 text-left text-[13px] font-semibold capitalize text-black/80">
                        {e.note}
                      </td>
                      <td className="px-3 py-2.5 text-left">
                        <span
                          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-[3px] text-[11px] font-bold"
                          style={{ background: expTint(e.category) + '1F', color: expTint(e.category) }}
                        >
                          <span className="h-[6px] w-[6px] rounded-full" style={{ background: expTint(e.category) }} />
                          {e.category}
                        </span>
                      </td>
                      <td className="num px-3 py-2.5 text-right text-[13px] font-extrabold text-black/80">
                        −{kyat(e.amount)}
                      </td>
                      <td className="pr-3">
                        {!readOnly && (
                          <button
                            onClick={() => onDelete(e.id)}
                            aria-label={`Delete ${e.note}`}
                            className="tap grid h-7 w-7 place-items-center rounded-full text-black/25 opacity-0 transition hover:bg-[#FFECEC] hover:text-[#E5484D] focus-visible:opacity-100 group-hover:opacity-100"
                          >
                            ×
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <footer className="flex items-baseline justify-between border-t border-black/[.06] px-5 py-3">
              <span className="text-[12.5px] font-semibold text-black/40">
                {table.length} {table.length === 1 ? 'entry' : 'entries'}
                {scope === 'range' && ` · ${prettyDate(from)} → ${prettyDate(to)}`}
              </span>
              <span className="num text-[14px] font-extrabold text-black/80">{kyat(tableTotal)}</span>
            </footer>
          </>
        )}
      </section>

      <Dialog open={!readOnly && open} onOpenChange={setOpen}>
        <DialogContent className="rounded-[26px] border-none p-6 sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-[20px] font-extrabold tracking-tight">Add an expense</DialogTitle>
          </DialogHeader>
          <div className="mt-2 space-y-3.5">
            <div>
              <span className="mb-2 block text-[12.5px] font-semibold text-black/50">Type</span>
              <div className="flex flex-wrap gap-2">
                {EXPENSE_CATEGORIES.map((c) => {
                  const on = c === category
                  return (
                    <button
                      key={c}
                      onClick={() => setCategory(c)}
                      className={`tap rounded-full px-3.5 py-2 text-[13px] font-bold transition ${
                        on ? 'text-white' : 'bg-black/[.05] text-black/55'
                      }`}
                      style={on ? { background: expTint(c) } : undefined}
                    >
                      {c}
                    </button>
                  )
                })}
              </div>
            </div>
            <label className="block">
              <span className="mb-1.5 block text-[12.5px] font-semibold text-black/50">Amount (Ks)</span>
              <input autoFocus type="number" min={0} className={inputCls} value={amount}
                onChange={(e) => setAmount(e.target.value)} placeholder="18000" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[12.5px] font-semibold text-black/50">Description</span>
              <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. October cargo, page boost" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[12.5px] font-semibold text-black/50">Date</span>
              <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
          </div>
          <DialogFooter className="mt-5 gap-2 sm:justify-end">
            <GhostButton onClick={() => setOpen(false)}>Cancel</GhostButton>
            <PrimaryButton onClick={save} disabled={!Number(amount)}>Add expense</PrimaryButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
