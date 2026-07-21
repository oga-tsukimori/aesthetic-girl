import * as React from 'react'
import type { Expense, Sale } from '@/data'
import { EXPENSE_CATEGORIES } from '@/data'
import { compact, expTint, kyat, monthKey, monthLabel, prettyDate } from '@/lib/shop'
import { EmptyState, GhostButton, MonthYearPicker, PrimaryButton, inputCls } from './bits'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'

export default function Expenses({
  expenses, sales, monthKeys, month, setMonth, onAdd, onDelete,
}: {
  expenses: Expense[]
  onAdd: (e: Omit<Expense, 'id'>) => void | Promise<void>
  onDelete: (id: string) => void | Promise<void>
  sales: Sale[]
  monthKeys: string[]
  month: string
  setMonth: (k: string) => void
}) {
  const [open, setOpen] = React.useState(false)
  const [category, setCategory] = React.useState<string>('Product stock')
  const [amount, setAmount] = React.useState('')
  const [note, setNote] = React.useState('')
  const [date, setDate] = React.useState(`${month}-01`)

  React.useEffect(() => setDate(`${month}-01`), [month])

  const rows = expenses
    .filter((e) => monthKey(e.date) === month)
    .sort((a, b) => b.date.localeCompare(a.date))

  const revenue = sales.filter((s) => monthKey(s.date) === month).reduce((t, s) => t + s.total, 0)
  const spend = rows.reduce((t, e) => t + e.amount, 0)
  const net = revenue - spend
  const margin = revenue ? (net / revenue) * 100 : 0

  const byCat = EXPENSE_CATEGORIES.map((c) => ({
    category: c as string,
    amount: rows.filter((e) => e.category === c).reduce((t, e) => t + e.amount, 0),
  })).filter((c) => c.amount > 0)
  const catMax = Math.max(...byCat.map((c) => c.amount), 1)

  const save = () => {
    const amt = Number(String(amount).replace(/,/g, ''))
    if (!amt || amt <= 0) return
    onAdd({ date, category, amount: amt, note: note.trim() || category })
    setAmount(''); setNote(''); setOpen(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MonthYearPicker value={month} onChange={setMonth} keys={monthKeys} label="Showing" />
        <PrimaryButton onClick={() => setOpen(true)}>+ Add expense</PrimaryButton>
      </div>

      {/* Net for the month — the number this tab exists for */}
      <section className="card-soft fadeup p-5 sm:p-6">
        <div className="text-[12.5px] font-bold uppercase tracking-[.07em] text-black/35">
          {monthLabel(month)} net
        </div>
        <div
          className="num mt-0.5 text-[clamp(34px,8vw,52px)] font-extrabold leading-none tracking-[-.04em]"
          style={{ color: net >= 0 ? '#1D1D1F' : '#E5484D' }}
        >
          {net.toLocaleString('en-US')}
          <span className="ml-1.5 text-[16px] font-bold text-black/30">Ks</span>
        </div>

        <div className="mt-4 flex items-center gap-1 text-[12.5px] font-bold">
          <span className="text-[#0F7B62]">{compact(revenue)} sales</span>
          <span className="text-black/25">−</span>
          <span className="text-[#7C6BEC]">{compact(spend)} expenses</span>
          {revenue > 0 && (
            <span className="ml-auto text-black/40">{margin.toFixed(0)}% margin</span>
          )}
        </div>
        <div className="mt-2 flex h-[10px] gap-[3px] overflow-hidden rounded-full bg-black/[.05]">
          <div
            className="rounded-full bg-[#34C7A5] transition-all duration-500"
            style={{ width: `${revenue ? Math.min(100, (Math.max(0, net) / revenue) * 100) : 0}%` }}
          />
          <div
            className="rounded-full bg-[#7C6BEC] transition-all duration-500"
            style={{ width: `${revenue ? Math.min(100, (spend / revenue) * 100) : spend ? 100 : 0}%` }}
          />
        </div>
      </section>

      {byCat.length > 0 && (
        <section className="card-soft fadeup p-5 sm:p-6">
          <h2 className="text-[16px] font-extrabold tracking-tight">Where it went</h2>
          <ul className="mt-3.5 space-y-3">
            {byCat.map((c) => (
              <li key={c.category}>
                <div className="flex items-baseline justify-between">
                  <span className="text-[13.5px] font-semibold text-black/70">{c.category}</span>
                  <span className="num text-[13px] font-bold text-black/45">{kyat(c.amount)}</span>
                </div>
                <div className="mt-1.5 h-[7px] rounded-full bg-black/[.05]">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${(c.amount / catMax) * 100}%`, background: expTint(c.category) }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {rows.length === 0 ? (
        <EmptyState
          title={`Nothing logged for ${monthLabel(month)}`}
          body="Add stock fees, cargo, boosts, or staff pay and they'll come off this month's sales."
        />
      ) : (
        <section className="card-soft fadeup overflow-hidden">
          <header className="flex items-baseline justify-between border-b border-black/[.06] px-5 py-3">
            <span className="text-[13.5px] font-extrabold text-black/70">{rows.length} entries</span>
            <span className="num text-[13px] font-bold text-black/40">{kyat(spend)}</span>
          </header>
          <ul className="divide-y divide-black/[.05]">
            {rows.map((e) => (
              <li key={e.id} className="group flex items-center gap-3 px-5 py-3">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: expTint(e.category) }} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-semibold capitalize text-black/80">{e.note}</div>
                  <div className="text-[12px] font-medium text-black/40">
                    {e.category} · {prettyDate(e.date)}
                  </div>
                </div>
                <span className="num shrink-0 text-[14.5px] font-extrabold text-black/80">−{kyat(e.amount)}</span>
                <button
                  onClick={() => onDelete(e.id)}
                  aria-label={`Delete ${e.note}`}
                  className="tap grid h-7 w-7 shrink-0 place-items-center rounded-full text-black/25 opacity-0 transition hover:bg-[#FFECEC] hover:text-[#E5484D] focus-visible:opacity-100 group-hover:opacity-100"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
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
              <span className="mb-1.5 block text-[12.5px] font-semibold text-black/50">What was it for</span>
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
