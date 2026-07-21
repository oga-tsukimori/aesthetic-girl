import * as React from 'react'
import type { Product } from '@/data'
import type { OrderInput } from '@/lib/api'
import { kyat } from '@/lib/shop'
import { GhostButton, PrimaryButton, inputCls } from './bits'

type Line = { key: string; productId: string | null; item: string; qty: string; unit: string }

const newLine = (): Line => ({
  key: Math.random().toString(36).slice(2, 8),
  productId: null, item: '', qty: '1', unit: '',
})

/* --------- searchable product picker: type to filter, click to choose --------- */

function ProductPicker({
  products, line, onPick,
}: { products: Product[]; line: Line; onPick: (p: Product | null, typed: string) => void }) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const box = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', away)
    return () => document.removeEventListener('mousedown', away)
  }, [])

  const q = query.trim().toLowerCase()
  const matches = products
    .filter((p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q))
    .slice(0, 40)

  const chosen = products.find((p) => p.id === line.productId)
  const label = chosen?.name ?? line.item

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); setQuery('') }}
        aria-expanded={open}
        className={`${inputCls} flex items-center justify-between gap-2 text-left`}
      >
        <span className={`truncate ${label ? 'text-[#1D1D1F]' : 'text-black/30'}`}>
          {label || 'Choose a product'}
        </span>
        <span className="shrink-0 text-[11px] text-black/35">▾</span>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-[18px] border border-black/[.07] bg-white shadow-[0_16px_44px_-14px_rgba(20,20,30,.32)]">
          <div className="border-b border-black/[.06] p-2">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products"
              className="w-full rounded-[12px] bg-[#F7F7FA] px-3 py-2 text-[14px] font-medium placeholder:text-black/30 focus:outline-none"
            />
          </div>
          <div className="max-h-[220px] overflow-y-auto p-1.5">
            {matches.length === 0 && (
              <p className="px-3 py-4 text-center text-[13px] font-semibold text-black/35">
                No product matches “{query}”. Type it in the name field instead.
              </p>
            )}
            {matches.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => { onPick(p, p.name); setOpen(false) }}
                className="tap flex w-full items-center gap-2 rounded-[12px] px-3 py-2 text-left hover:bg-black/[.045]"
              >
                <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold capitalize text-black/80">
                  {p.name}
                </span>
                <span
                  className="num shrink-0 text-[12px] font-bold"
                  style={{ color: p.qty === 0 ? '#E5484D' : p.qty <= 3 ? '#B26A00' : '#0F7B62' }}
                >
                  {p.qty} left
                </span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => { onPick(null, query); setOpen(false) }}
            className="tap w-full border-t border-black/[.06] px-3 py-2.5 text-[13px] font-bold text-[#FF6B8A] hover:bg-[#FFF3F6]"
          >
            {query.trim() ? `Use “${query.trim()}” as a one-off item` : 'Add a one-off item instead'}
          </button>
        </div>
      )}
    </div>
  )
}

/* ------------------------------- toggle pair ------------------------------- */

function Toggle<T extends string>({
  value, onChange, options, label,
}: { value: T; onChange: (v: T) => void; options: { value: T; label: string; color: string }[]; label: string }) {
  return (
    <div>
      <span className="mb-1.5 block text-[12.5px] font-semibold text-black/50">{label}</span>
      <div className="inline-flex w-full rounded-full bg-black/[.055] p-[3px]">
        {options.map((o) => {
          const on = o.value === value
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange(o.value)}
              aria-pressed={on}
              className={`tap flex-1 rounded-full px-3 py-2 text-[13px] font-bold transition ${
                on ? 'text-white' : 'text-black/45'
              }`}
              style={on ? { background: o.color } : undefined}
            >
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* --------------------------------- form ----------------------------------- */

export default function OrderForm({
  products, preset, onSave, onCancel, busy, error,
}: {
  products: Product[]
  preset?: Product | null
  onSave: (o: OrderInput) => void
  onCancel: () => void
  busy?: boolean
  error?: string | null
}) {
  const [customer, setCustomer] = React.useState('')
  const [phone, setPhone] = React.useState('')
  const [address, setAddress] = React.useState('')
  const [date, setDate] = React.useState('2026-07-21')
  const [fulfilment, setFulfilment] = React.useState<'instock' | 'preorder'>('instock')
  const [payment, setPayment] = React.useState<'cod' | 'kpay'>('cod')
  const [note, setNote] = React.useState('')
  const [lines, setLines] = React.useState<Line[]>(() => [
    preset
      ? { ...newLine(), productId: preset.id, item: preset.name, unit: preset.price ? String(preset.price) : '' }
      : newLine(),
  ])

  const patch = (key: string, next: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...next } : l)))

  const total = lines.reduce((t, l) => t + (Number(l.qty) || 0) * (Number(l.unit) || 0), 0)

  const lineError = (l: Line) => {
    if (!l.item.trim()) return 'Pick a product'
    if (!(Number(l.qty) > 0)) return 'Quantity must be above zero'
    if (!(Number(l.unit) > 0)) return 'Add a unit price'
    const p = products.find((x) => x.id === l.productId)
    if (fulfilment === 'instock' && p && Number(l.qty) > p.qty)
      return `Only ${p.qty} in stock — switch to preorder or lower it`
    return null
  }

  const valid = lines.length > 0 && lines.every((l) => !lineError(l))

  return (
    <div className="space-y-4">
      {/* customer */}
      <section className="space-y-2.5">
        <h3 className="text-[12px] font-bold uppercase tracking-[.07em] text-black/35">Customer</h3>
        <input className={inputCls} value={customer} onChange={(e) => setCustomer(e.target.value)}
          placeholder="Name" autoFocus />
        <div className="grid gap-2.5 sm:grid-cols-2">
          <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone" inputMode="tel" />
          <input className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} type="date" />
        </div>
        <textarea className={inputCls + ' min-h-[62px] resize-none'} value={address}
          onChange={(e) => setAddress(e.target.value)} placeholder="Delivery address" />
      </section>

      {/* items */}
      <section className="space-y-2.5">
        <h3 className="text-[12px] font-bold uppercase tracking-[.07em] text-black/35">Items</h3>
        {lines.map((l, i) => {
          const err = l.item.trim() ? lineError(l) : null
          return (
            <div key={l.key} className="rounded-[18px] bg-[#F7F7FA] p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11.5px] font-bold text-black/35">Item {i + 1}</span>
                {lines.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                    aria-label={`Remove item ${i + 1}`}
                    className="tap grid h-6 w-6 place-items-center rounded-full text-[15px] text-black/30 hover:bg-[#FFECEC] hover:text-[#E5484D]"
                  >
                    ×
                  </button>
                )}
              </div>

              <ProductPicker
                products={products}
                line={l}
                onPick={(p, typed) =>
                  patch(l.key, {
                    productId: p?.id ?? null,
                    item: p?.name ?? typed,
                    unit: p?.price ? String(p.price) : l.unit,
                  })
                }
              />

              {!l.productId && l.item && (
                <input className={inputCls + ' mt-2'} value={l.item}
                  onChange={(e) => patch(l.key, { item: e.target.value })} placeholder="Item name" />
              )}

              <div className="mt-2 grid grid-cols-[80px_1fr_auto] items-center gap-2">
                <input type="number" min={1} className={inputCls} value={l.qty}
                  onChange={(e) => patch(l.key, { qty: e.target.value })} aria-label="Quantity" />
                <input type="number" min={0} className={inputCls} value={l.unit}
                  onChange={(e) => patch(l.key, { unit: e.target.value })} placeholder="Unit price"
                  aria-label="Unit price" />
                <span className="num w-[92px] shrink-0 text-right text-[14px] font-extrabold text-black/70">
                  {kyat((Number(l.qty) || 0) * (Number(l.unit) || 0))}
                </span>
              </div>

              {err && <p className="mt-1.5 text-[11.5px] font-semibold text-[#E5484D]">{err}</p>}
            </div>
          )
        })}

        <button
          type="button"
          onClick={() => setLines((ls) => [...ls, newLine()])}
          className="tap w-full rounded-[16px] border border-dashed border-black/15 py-2.5 text-[13.5px] font-bold text-black/50 hover:border-[#FF6B8A] hover:text-[#FF6B8A]"
        >
          + Add another item
        </button>
      </section>

      {/* how it's sold */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Toggle
          label="Stock"
          value={fulfilment}
          onChange={setFulfilment}
          options={[
            { value: 'instock', label: 'In stock', color: '#0F9F80' },
            { value: 'preorder', label: 'Preorder', color: '#F0932B' },
          ]}
        />
        <Toggle
          label="Payment"
          value={payment}
          onChange={setPayment}
          options={[
            { value: 'cod', label: 'COD', color: '#1D1D1F' },
            { value: 'kpay', label: 'KPay', color: '#2F6BD8' },
          ]}
        />
      </div>

      <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)}
        placeholder="Note (deposit paid, delivery date…)" />

      {fulfilment === 'preorder' && (
        <p className="rounded-[14px] bg-[#FFF6E8] px-3.5 py-2.5 text-[12.5px] font-semibold text-[#8A5A00]">
          Preorders don't take anything off your stock counts.
        </p>
      )}

      {error && (
        <p className="rounded-[14px] bg-[#FFECEC] px-3.5 py-2.5 text-[12.5px] font-semibold text-[#E5484D]">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between rounded-[16px] bg-[#FFEFF3] px-4 py-3">
        <span className="text-[13px] font-bold text-[#C2185B]">
          Order total · {lines.length} {lines.length === 1 ? 'item' : 'items'}
        </span>
        <span className="num text-[20px] font-extrabold text-[#C2185B]">{kyat(total)}</span>
      </div>

      <div className="flex justify-end gap-2">
        <GhostButton onClick={onCancel}>Cancel</GhostButton>
        <PrimaryButton
          disabled={!valid || busy}
          onClick={() =>
            onSave({
              customer, phone, address, date, fulfilment, payment, note,
              items: lines.map((l) => ({
                productId: l.productId, item: l.item.trim(), qty: Number(l.qty), unit: Number(l.unit),
              })),
            })
          }
        >
          {busy ? 'Saving…' : 'Record order'}
        </PrimaryButton>
      </div>
    </div>
  )
}
