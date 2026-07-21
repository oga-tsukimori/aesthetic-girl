import * as React from 'react'
import type { Expense, Sale } from '@/data'
import { compact, kyat, monthKey, monthLabel, prettyDate, tint } from '@/lib/shop'
import { CategoryChip, EmptyState, MonthYearPicker, PrimaryButton, inputCls } from './bits'

export default function Sales({
  sales, expenses, monthKeys, month, setMonth, onRecord, onDelete,
}: {
  sales: Sale[]
  expenses: Expense[]
  monthKeys: string[]
  month: string
  setMonth: (k: string) => void
  onRecord: () => void
  onDelete: (id: string) => void
}) {
  const [q, setQ] = React.useState('')

  const rows = sales
    .filter((s) => monthKey(s.date) === month && s.item.toLowerCase().includes(q.toLowerCase().trim()))
    .sort((a, b) => b.date.localeCompare(a.date))

  const inMonth = sales.filter((s) => monthKey(s.date) === month)
  const revenue = inMonth.reduce((t, s) => t + s.total, 0)
  const spend = expenses.filter((e) => monthKey(e.date) === month).reduce((t, e) => t + e.amount, 0)
  const units = inMonth.reduce((t, s) => t + s.qty, 0)

  const byDay = React.useMemo(() => {
    const map = new Map<string, Sale[]>()
    for (const s of rows) map.set(s.date, [...(map.get(s.date) ?? []), s])
    return [...map.entries()]
  }, [rows])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MonthYearPicker value={month} onChange={setMonth} keys={monthKeys} label="Showing" />
        <PrimaryButton onClick={onRecord}>+ Record a sale</PrimaryButton>
      </div>

      <div className="card-soft fadeup flex flex-wrap items-end justify-between gap-4 p-5 sm:p-6">
        <div>
          <div className="text-[12.5px] font-bold uppercase tracking-[.07em] text-black/35">
            {monthLabel(month)} sales
          </div>
          <div className="num mt-0.5 text-[34px] font-extrabold leading-none tracking-[-.03em]">
            {revenue.toLocaleString('en-US')}
            <span className="ml-1.5 text-[15px] font-bold text-black/30">Ks</span>
          </div>
          <div className="mt-1.5 text-[12.5px] font-semibold text-black/40">
            less {compact(spend)} Ks expenses ·{' '}
            <span style={{ color: revenue - spend >= 0 ? '#0F7B62' : '#E5484D' }}>
              {kyat(revenue - spend)} net
            </span>
          </div>
        </div>
        <div className="flex gap-6 text-right">
          <div>
            <div className="num text-[20px] font-extrabold">{inMonth.length}</div>
            <div className="text-[12px] font-semibold text-black/40">orders</div>
          </div>
          <div>
            <div className="num text-[20px] font-extrabold">{units}</div>
            <div className="text-[12px] font-semibold text-black/40">items</div>
          </div>
          <div>
            <div className="num text-[20px] font-extrabold">
              {inMonth.length ? compact(Math.round(revenue / inMonth.length)) : '—'}
            </div>
            <div className="text-[12px] font-semibold text-black/40">avg order</div>
          </div>
        </div>
      </div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search this month's sales"
        className={inputCls}
      />

      {byDay.length === 0 ? (
        <EmptyState title="No sales here yet" body="Use Record a sale above to log one, or pick another month." />
      ) : (
        <div className="space-y-3">
          {byDay.map(([day, items]) => (
            <section key={day} className="card-soft fadeup overflow-hidden">
              <header className="flex items-baseline justify-between border-b border-black/[.06] px-5 py-3">
                <span className="text-[13.5px] font-extrabold text-black/70">{prettyDate(day)}</span>
                <span className="num text-[13px] font-bold text-black/40">
                  {kyat(items.reduce((t, s) => t + s.total, 0))}
                </span>
              </header>
              <ul className="divide-y divide-black/[.05]">
                {items.map((s) => (
                  <li key={s.id} className="group flex items-center gap-3 px-5 py-3">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: tint(s.cat).dot }} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="truncate text-[14px] font-semibold capitalize text-black/80">{s.item}</span>
                        {s.fulfilment === 'preorder' && (
                          <span className="rounded-full bg-[#FFF3DC] px-2 py-[1px] text-[10.5px] font-bold uppercase tracking-wide text-[#8A5A00]">
                            preorder
                          </span>
                        )}
                        {s.payment && (
                          <span
                            className="rounded-full px-2 py-[1px] text-[10.5px] font-bold uppercase tracking-wide"
                            style={s.payment === 'kpay'
                              ? { background: '#E8F0FD', color: '#2F6BD8' }
                              : { background: '#F1F1F4', color: '#54545C' }}
                          >
                            {s.payment}
                          </span>
                        )}
                      </div>
                      <div className="text-[12px] font-medium text-black/40">
                        {s.customer ? `${s.customer} · ` : ''}{s.qty} × {kyat(s.unit)}{s.note ? ` · ${s.note}` : ''}
                      </div>
                    </div>
                    <CategoryChip cat={s.cat} className="hidden md:inline-flex" />
                    <span className="num w-[104px] shrink-0 text-right text-[14.5px] font-extrabold text-black/80">
                      {kyat(s.total)}
                    </span>
                    <button
                      onClick={() => onDelete(s.id)}
                      aria-label={`Delete sale of ${s.item}`}
                      className="tap grid h-7 w-7 shrink-0 place-items-center rounded-full text-black/25 opacity-0 transition hover:bg-[#FFECEC] hover:text-[#E5484D] focus-visible:opacity-100 group-hover:opacity-100"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
