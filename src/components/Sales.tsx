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

  const term = q.toLowerCase().trim()
  const rows = sales
    .filter(
      (s) =>
        monthKey(s.date) === month &&
        (s.item.toLowerCase().includes(term) || (s.customer ?? '').toLowerCase().includes(term))
    )
    .sort((a, b) => b.date.localeCompare(a.date))

  const inMonth = sales.filter((s) => monthKey(s.date) === month)
  const revenue = inMonth.reduce((t, s) => t + s.total, 0)
  const spend = expenses.filter((e) => monthKey(e.date) === month).reduce((t, e) => t + e.amount, 0)
  const units = inMonth.reduce((t, s) => t + s.qty, 0)

  /** day → order → the items in that order. Lines with no order stand alone. */
  const byDay = React.useMemo(() => {
    const days = new Map<string, Map<string, Sale[]>>()
    for (const s of rows) {
      const orders = days.get(s.date) ?? new Map<string, Sale[]>()
      const key = s.orderId ?? (s.customer ? `who:${s.customer.toLowerCase()}` : `one:${s.id}`)
      orders.set(key, [...(orders.get(key) ?? []), s])
      days.set(s.date, orders)
    }
    return [...days.entries()].map(([day, orders]) => [day, [...orders.values()]] as const)
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
          {byDay.map(([day, groups]) => (
            <section key={day} className="card-soft fadeup overflow-hidden">
              <header className="flex items-baseline justify-between border-b border-black/[.06] px-5 py-3">
                <span className="text-[13.5px] font-extrabold text-black/70">{prettyDate(day)}</span>
                <span className="num text-[13px] font-bold text-black/40">
                  {kyat(groups.flat().reduce((t, s) => t + s.total, 0))}
                </span>
              </header>
              <div className="divide-y divide-black/[.05]">
                {groups.map((items) => {
                  const head = items[0]
                  const orderTotal = items.reduce((t, x) => t + x.total, 0)
                  const named = Boolean(head.customer)

                  return (
                    <div key={head.orderId ?? head.id} className="px-5 py-3">
                      {/* who bought — the order's own header */}
                      {(named || items.length > 1) && (
                        <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="text-[14px] font-extrabold text-[#1D1D1F]">
                            {head.customer || 'Unnamed order'}
                          </span>
                          {head.phone && (
                            <span className="num text-[12px] font-semibold text-black/40">{head.phone}</span>
                          )}
                          {head.fulfilment === 'preorder' && (
                            <span className="rounded-full bg-[#FFF3DC] px-2 py-[1px] text-[10.5px] font-bold uppercase tracking-wide text-[#8A5A00]">
                              preorder
                            </span>
                          )}
                          {head.payment && (
                            <span
                              className="rounded-full px-2 py-[1px] text-[10.5px] font-bold uppercase tracking-wide"
                              style={head.payment === 'kpay'
                                ? { background: '#E8F0FD', color: '#2F6BD8' }
                                : { background: '#F1F1F4', color: '#54545C' }}
                            >
                              {head.payment}
                            </span>
                          )}
                          <span className="ml-auto flex items-baseline gap-2">
                            <span className="text-[11.5px] font-semibold text-black/35">
                              {items.length} {items.length === 1 ? 'item' : 'items'}
                            </span>
                            <span className="num text-[14.5px] font-extrabold text-black/80">
                              {kyat(orderTotal)}
                            </span>
                          </span>
                        </div>
                      )}

                      <ul className={named || items.length > 1 ? 'space-y-1 border-l-2 border-black/[.07] pl-3' : ''}>
                        {items.map((s) => (
                          <li key={s.id} className="group flex items-center gap-3">
                            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: tint(s.cat).dot }} />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-[13.5px] font-semibold capitalize text-black/75">
                                {s.item}
                              </div>
                              <div className="text-[12px] font-medium text-black/40">
                                {s.qty} × {kyat(s.unit)}{s.note ? ` · ${s.note}` : ''}
                              </div>
                            </div>
                            <CategoryChip cat={s.cat} className="hidden md:inline-flex" />
                            <span className="num w-[104px] shrink-0 text-right text-[13.5px] font-bold text-black/70">
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

                      {head.address && (
                        <p className="mt-1.5 pl-3 text-[12px] font-medium text-black/35">{head.address}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
