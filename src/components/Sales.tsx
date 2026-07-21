import * as React from 'react'
import type { Expense, Sale } from '@/data'
import { compact, kyat, monthKey, monthLabel, prettyDate, tint } from '@/lib/shop'
import { CategoryChip, EmptyState, GhostButton, MonthYearPicker, PrimaryButton, inputCls } from './bits'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { MapPin, Phone } from 'lucide-react'

export type OrderPatch = {
  customer: string; phone: string; address: string
  date: string; fulfilment: 'instock' | 'preorder'; payment: 'cod' | 'kpay'
}

type Group = { key: string; head: Sale; items: Sale[]; orderId: string | null; total: number }

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '—'

/** Stable pastel per customer, so the same person keeps the same badge. */
const AVATARS = ['#FF6B8A', '#5AA9FA', '#34C7A5', '#FFB020', '#8B7BEC', '#F07CB8', '#43BEDC', '#8CC63F']
const avatarOf = (name: string) => {
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 9973
  return AVATARS[h % AVATARS.length]
}

export default function Sales({
  sales, expenses, monthKeys, month, setMonth, onRecord, onDelete, onDeleteOrder, onEditOrder,
}: {
  sales: Sale[]
  expenses: Expense[]
  monthKeys: string[]
  month: string
  setMonth: (k: string) => void
  onRecord: () => void
  onDelete: (id: string) => void
  onDeleteOrder: (orderId: string) => void
  onEditOrder: (orderId: string, patch: OrderPatch) => void
}) {
  const [q, setQ] = React.useState('')
  const [editing, setEditing] = React.useState<Group | null>(null)
  const [confirming, setConfirming] = React.useState<Group | null>(null)

  const term = q.toLowerCase().trim()
  const rows = sales
    .filter(
      (s) =>
        monthKey(s.date) === month &&
        (s.item.toLowerCase().includes(term) ||
          (s.customer ?? '').toLowerCase().includes(term) ||
          (s.phone ?? '').includes(term))
    )
    .sort((a, b) => b.date.localeCompare(a.date))

  const inMonth = sales.filter((s) => monthKey(s.date) === month)
  const revenue = inMonth.reduce((t, s) => t + s.total, 0)
  const spend = expenses.filter((e) => monthKey(e.date) === month).reduce((t, e) => t + e.amount, 0)
  const units = inMonth.reduce((t, s) => t + s.qty, 0)

  /** One card per order. Rows with no customer pool into that day's walk-ins. */
  const groups: Group[] = React.useMemo(() => {
    const map = new Map<string, Sale[]>()
    for (const s of rows) {
      const key = s.orderId ?? (s.customer ? `who:${s.date}:${s.customer.toLowerCase()}` : `walk:${s.date}`)
      map.set(key, [...(map.get(key) ?? []), s])
    }
    return [...map.entries()].map(([key, items]) => ({
      key, items, head: items[0],
      orderId: items[0].orderId ?? null,
      total: items.reduce((t, s) => t + s.total, 0),
    }))
  }, [rows])

  const customers = new Set(inMonth.map((s) => s.customer).filter(Boolean)).size

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
            <div className="num text-[20px] font-extrabold">{groups.length}</div>
            <div className="text-[12px] font-semibold text-black/40">orders</div>
          </div>
          <div>
            <div className="num text-[20px] font-extrabold">{customers || '—'}</div>
            <div className="text-[12px] font-semibold text-black/40">customers</div>
          </div>
          <div>
            <div className="num text-[20px] font-extrabold">{units}</div>
            <div className="text-[12px] font-semibold text-black/40">items</div>
          </div>
        </div>
      </div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by customer, phone or item"
        className={inputCls}
      />

      {groups.length === 0 ? (
        <EmptyState title="No sales here yet" body="Use Record a sale above to log one, or pick another month." />
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {groups.map((g) => (
            <OrderCard
              key={g.key}
              group={g}
              onEdit={() => setEditing(g)}
              onDelete={() => setConfirming(g)}
              onDeleteLine={onDelete}
            />
          ))}
        </div>
      )}

      {editing && (
        <EditOrderDialog
          group={editing}
          onClose={() => setEditing(null)}
          onSave={(patch) => {
            if (editing.orderId) onEditOrder(editing.orderId, patch)
            setEditing(null)
          }}
        />
      )}

      <Dialog open={!!confirming} onOpenChange={(o) => !o && setConfirming(null)}>
        <DialogContent className="rounded-[26px] border-none p-6 sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle className="text-[19px] font-extrabold tracking-tight">
              Delete {confirming?.head.customer ? `${confirming.head.customer}'s order` : 'these sales'}?
            </DialogTitle>
          </DialogHeader>
          <p className="text-[14px] font-medium leading-relaxed text-black/50">
            {confirming?.items.length} {confirming?.items.length === 1 ? 'line' : 'lines'} worth{' '}
            {kyat(confirming?.total ?? 0)}.{' '}
            {confirming?.head.fulfilment === 'preorder'
              ? 'Nothing returns to stock — preorders never left it.'
              : 'The items go back into stock.'}
          </p>
          <DialogFooter className="mt-5 gap-2 sm:justify-end">
            <GhostButton onClick={() => setConfirming(null)}>Keep it</GhostButton>
            <button
              onClick={() => {
                if (confirming?.orderId) onDeleteOrder(confirming.orderId)
                else confirming?.items.forEach((s) => onDelete(s.id))
                setConfirming(null)
              }}
              className="tap rounded-full bg-[#E5484D] px-5 py-2.5 text-[14.5px] font-bold text-white hover:bg-[#D53F44]"
            >
              Delete
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ------------------------------- the card -------------------------------- */

function OrderCard({
  group, onEdit, onDelete, onDeleteLine,
}: { group: Group; onEdit: () => void; onDelete: () => void; onDeleteLine: (id: string) => void }) {
  const { head, items, total } = group
  const named = Boolean(head.customer)
  const who = head.customer || 'Walk-in sales'
  const colour = named ? avatarOf(who) : '#C7C7CE'
  const [menu, setMenu] = React.useState(false)

  const menuItem =
    'tap flex w-full items-center rounded-[12px] px-3 py-2.5 text-[14px] font-semibold ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/15'

  return (
    <article className="card-soft fadeup flex flex-col overflow-hidden">
      {/* who */}
      <div className="flex items-start gap-3 px-4 pt-4 sm:px-5">
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[13px] font-black text-white"
          style={{ background: colour }}
          aria-hidden
        >
          {named ? initials(who) : '⌂'}
        </span>

        <div className="min-w-0 flex-1">
          <h3
            className="truncate text-[15.5px] font-extrabold tracking-tight"
            style={{ color: named ? '#1D1D1F' : 'rgba(0,0,0,.4)' }}
          >
            {who}
          </h3>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] font-semibold text-black/40">
            <span className="num">{prettyDate(head.date)}</span>
            {head.phone && (
              <a
                href={`tel:${head.phone.replace(/\s/g, '')}`}
                className="num flex items-center gap-1 text-black/55 hover:text-[#FF6B8A]"
              >
                <Phone size={11} strokeWidth={2.8} />
                {head.phone}
              </a>
            )}
          </div>
        </div>

        <Popover open={menu} onOpenChange={setMenu}>
          <PopoverTrigger asChild>
            <button
              aria-label={`Actions for ${who}`}
              className="tap grid h-8 w-8 shrink-0 place-items-center rounded-full text-[17px] font-bold leading-none text-black/35 hover:bg-black/[.06] hover:text-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20"
            >
              ⋯
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            sideOffset={6}
            className="w-[184px] rounded-[18px] border-none p-1.5 shadow-[0_10px_36px_-10px_rgba(20,20,30,.28)]"
          >
            {group.orderId ? (
              <button className={menuItem + ' text-black/75 hover:bg-black/[.05]'}
                onClick={() => { setMenu(false); onEdit() }}>
                Edit order
              </button>
            ) : (
              <p className="px-3 py-2 text-[12px] font-medium leading-snug text-black/35">
                Imported rows have no order to edit.
              </p>
            )}
            <button className={menuItem + ' text-[#E5484D] hover:bg-[#FFECEC]'}
              onClick={() => { setMenu(false); onDelete() }}>
              Delete {group.orderId ? 'order' : 'sales'}
            </button>
          </PopoverContent>
        </Popover>
      </div>

      {/* how it's sold */}
      {(head.payment || head.fulfilment === 'preorder' || head.address) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 px-4 sm:px-5">
          {head.fulfilment === 'preorder' && (
            <span className="rounded-full bg-[#FFF3DC] px-2 py-[3px] text-[10.5px] font-bold uppercase tracking-wide text-[#8A5A00]">
              preorder
            </span>
          )}
          {head.payment && (
            <span
              className="rounded-full px-2 py-[3px] text-[10.5px] font-bold uppercase tracking-wide"
              style={head.payment === 'kpay'
                ? { background: '#E8F0FD', color: '#2F6BD8' }
                : { background: '#F1F1F4', color: '#54545C' }}
            >
              {head.payment}
            </span>
          )}
          {head.address && (
            <span className="flex min-w-0 items-center gap-1 text-[12px] font-medium text-black/45">
              <MapPin size={12} strokeWidth={2.6} className="shrink-0 text-black/30" />
              <span className="truncate">{head.address}</span>
            </span>
          )}
        </div>
      )}

      {/* what they bought */}
      <ul className="mt-3 divide-y divide-black/[.05] border-t border-black/[.05]">
        {items.map((s) => (
          <li key={s.id} className="group flex items-center gap-3 px-4 py-2.5 sm:px-5">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: tint(s.cat).dot }} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13.5px] font-semibold capitalize text-black/80">{s.item}</div>
              <div className="num text-[12px] font-medium text-black/40">
                {s.qty} × {kyat(s.unit)}
                {s.note ? ` · ${s.note}` : ''}
              </div>
            </div>
            <CategoryChip cat={s.cat} className="hidden lg:inline-flex" />
            <span className="num shrink-0 text-[13.5px] font-bold text-black/70">{kyat(s.total)}</span>
            <button
              onClick={() => onDeleteLine(s.id)}
              aria-label={`Remove ${s.item} from this order`}
              className="tap grid h-6 w-6 shrink-0 place-items-center rounded-full text-black/20 opacity-0 transition hover:bg-[#FFECEC] hover:text-[#E5484D] focus-visible:opacity-100 group-hover:opacity-100"
            >
              ×
            </button>
          </li>
        ))}
      </ul>

      {/* the one total that matters */}
      <div className="mt-auto flex items-baseline justify-between bg-[#FAFAFC] px-4 py-3 sm:px-5">
        <span className="text-[12px] font-bold uppercase tracking-[.06em] text-black/35">
          {items.length} {items.length === 1 ? 'item' : 'items'}
        </span>
        <span className="num text-[17px] font-extrabold text-[#1D1D1F]">{kyat(total)}</span>
      </div>
    </article>
  )
}

/* ---------------------------- edit order details -------------------------- */

function EditOrderDialog({
  group, onSave, onClose,
}: { group: Group; onSave: (p: OrderPatch) => void; onClose: () => void }) {
  const h = group.head
  const [customer, setCustomer] = React.useState(h.customer ?? '')
  const [phone, setPhone] = React.useState(h.phone ?? '')
  const [address, setAddress] = React.useState(h.address ?? '')
  const [date, setDate] = React.useState(h.date)
  const [fulfilment, setFulfilment] = React.useState<'instock' | 'preorder'>(h.fulfilment ?? 'instock')
  const [payment, setPayment] = React.useState<'cod' | 'kpay'>(h.payment ?? 'cod')

  const toggle = (on: boolean) =>
    `tap flex-1 rounded-full px-3 py-2 text-[13px] font-bold transition ${on ? 'text-white' : 'text-black/45'}`

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] overflow-y-auto rounded-[26px] border-none p-6 sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="text-[20px] font-extrabold tracking-tight">Edit order</DialogTitle>
        </DialogHeader>
        <div className="mt-2 space-y-3.5">
          <label className="block">
            <span className="mb-1.5 block text-[12.5px] font-semibold text-black/50">Customer</span>
            <input autoFocus className={inputCls} value={customer} onChange={(e) => setCustomer(e.target.value)} />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-[12.5px] font-semibold text-black/50">Phone</span>
              <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[12.5px] font-semibold text-black/50">Date</span>
              <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-[12.5px] font-semibold text-black/50">Address</span>
            <textarea className={inputCls + ' min-h-[62px] resize-none'} value={address}
              onChange={(e) => setAddress(e.target.value)} />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <span className="mb-1.5 block text-[12.5px] font-semibold text-black/50">Stock</span>
              <div className="inline-flex w-full rounded-full bg-black/[.055] p-[3px]">
                <button className={toggle(fulfilment === 'instock')} onClick={() => setFulfilment('instock')}
                  style={fulfilment === 'instock' ? { background: '#0F9F80' } : undefined}>In stock</button>
                <button className={toggle(fulfilment === 'preorder')} onClick={() => setFulfilment('preorder')}
                  style={fulfilment === 'preorder' ? { background: '#F0932B' } : undefined}>Preorder</button>
              </div>
            </div>
            <div>
              <span className="mb-1.5 block text-[12.5px] font-semibold text-black/50">Payment</span>
              <div className="inline-flex w-full rounded-full bg-black/[.055] p-[3px]">
                <button className={toggle(payment === 'cod')} onClick={() => setPayment('cod')}
                  style={payment === 'cod' ? { background: '#1D1D1F' } : undefined}>COD</button>
                <button className={toggle(payment === 'kpay')} onClick={() => setPayment('kpay')}
                  style={payment === 'kpay' ? { background: '#2F6BD8' } : undefined}>KPay</button>
              </div>
            </div>
          </div>
          <p className="rounded-[14px] bg-[#F7F7FA] px-3.5 py-2.5 text-[12px] font-medium text-black/45">
            Items stay as they are. Remove a line with the × beside it, or delete the order and record it again.
          </p>
        </div>
        <DialogFooter className="mt-5 gap-2 sm:justify-end">
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton onClick={() => onSave({ customer, phone, address, date, fulfilment, payment })}>
            Save changes
          </PrimaryButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
