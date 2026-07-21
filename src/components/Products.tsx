import * as React from 'react'
import type { Product } from '@/data'
import { PHOTOS } from '@/data'
import { kyat, statusOf, swatch, tint } from '@/lib/shop'
import {
  CategoryChip, ColorChip, EmptyState, Field, GhostButton, ModelChip, PrimaryButton, StatusPill,
  StockNumber, inputCls,
} from './bits'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

type Draft = { name: string; category: string; qty: string; price: string }
const blank: Draft = { name: '', category: 'iPad Cover', qty: '0', price: '' }

function Thumb({ p, size }: { p: Product; size: number }) {
  const src = p.photo ? PHOTOS[p.photo] : null
  const t = tint(p.category)
  if (src)
    return (
      <img
        src={src}
        alt={p.name}
        loading="lazy"
        className="shrink-0 rounded-[14px] object-cover"
        style={{ width: size, height: size, background: t.bg }}
      />
    )
  return (
    <div
      className="grid shrink-0 place-items-center rounded-[14px] text-[15px] font-black uppercase"
      style={{ width: size, height: size, background: t.bg, color: t.fg }}
      aria-hidden
    >
      {(p.base ?? p.name).slice(0, 2)}
    </div>
  )
}

function MoreMenu({ p, onEdit, onRemove }: { p: Product; onEdit: () => void; onRemove: () => void }) {
  const [open, setOpen] = React.useState(false)
  const item =
    'tap flex w-full items-center gap-2.5 rounded-[12px] px-3 py-2.5 text-[14px] font-semibold ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/15'
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          aria-label={`More actions for ${p.name}`}
          className="tap grid h-8 w-8 shrink-0 place-items-center rounded-full text-[17px] font-bold leading-none text-black/35 hover:bg-black/[.06] hover:text-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20"
        >
          ⋯
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-[168px] rounded-[18px] border-none p-1.5 shadow-[0_10px_36px_-10px_rgba(20,20,30,.28)]"
      >
        <button className={item + ' text-black/75 hover:bg-black/[.05]'}
          onClick={() => { setOpen(false); onEdit() }}>
          Edit product
        </button>
        <button className={item + ' text-[#E5484D] hover:bg-[#FFECEC]'}
          onClick={() => { setOpen(false); onRemove() }}>
          Remove
        </button>
      </PopoverContent>
    </Popover>
  )
}

export type ProductActions = {
  create: (p: Omit<Product, 'id'>) => void | Promise<void>
  update: (id: string, patch: Partial<Product>) => void | Promise<void>
  adjust: (id: string, by: number) => void | Promise<void>
  remove: (id: string) => void | Promise<void>
}

export default function Products({ products, actions }: { products: Product[]; actions: ProductActions }) {
  const [q, setQ] = React.useState('')
  const [cat, setCat] = React.useState('All')
  const [only, setOnly] = React.useState<'all' | 'low' | 'out'>('all')
  const [view, setView] = React.useState<'card' | 'list'>('card')
  const [editing, setEditing] = React.useState<Product | null>(null)
  const [draft, setDraft] = React.useState<Draft>(blank)
  const [open, setOpen] = React.useState(false)
  const [removing, setRemoving] = React.useState<Product | null>(null)

  const cats = React.useMemo(
    () => ['All', ...[...new Set(products.map((p) => p.category))].sort()],
    [products]
  )
  const colours = React.useMemo(
    () => ['All', ...[...new Set(products.map((p) => p.color).filter(Boolean) as string[])].sort()],
    [products]
  )
  const [colour, setColour] = React.useState('All')

  const list = products.filter((p) => {
    if (cat !== 'All' && p.category !== cat) return false
    if (colour !== 'All' && p.color !== colour) return false
    if (only === 'low' && statusOf(p.qty) !== 'low') return false
    if (only === 'out' && p.qty > 0) return false
    return p.name.toLowerCase().includes(q.toLowerCase().trim())
  })

  const openNew = () => { setEditing(null); setDraft(blank); setOpen(true) }
  const openEdit = (p: Product) => {
    setEditing(p)
    setDraft({ name: p.name, category: p.category, qty: String(p.qty), price: p.price ? String(p.price) : '' })
    setOpen(true)
  }

  const save = () => {
    const name = draft.name.trim()
    if (!name) return
    const fields = {
      name,
      category: draft.category,
      qty: Math.max(0, Number(draft.qty) || 0),
      price: draft.price ? Number(String(draft.price).replace(/,/g, '')) : null,
      photo: editing?.photo ?? null,
    }
    if (editing) actions.update(editing.id, fields)
    else actions.create(fields)
    setOpen(false)
  }

  const bump = (id: string, by: number) => actions.adjust(id, by)

  const Stepper = ({ p }: { p: Product }) => (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => bump(p.id, -1)}
        disabled={p.qty === 0}
        aria-label={`Remove one ${p.name}`}
        className="tap grid h-8 w-8 place-items-center rounded-full border border-black/[.08] bg-white text-[18px] font-bold text-black/60 disabled:opacity-30"
      >
        −
      </button>
      <button
        onClick={() => bump(p.id, 1)}
        aria-label={`Add one ${p.name}`}
        className="tap grid h-8 w-8 place-items-center rounded-full border border-black/[.08] bg-white text-[18px] font-bold text-black/60"
      >
        +
      </button>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[180px] flex-1">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search products"
            className={inputCls + ' pl-9'}
          />
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[14px] text-black/30">⌕</span>
        </div>

        <div className="inline-flex rounded-full bg-black/[.055] p-[3px]">
          {(['all', 'low', 'out'] as const).map((k) => (
            <button
              key={k}
              onClick={() => setOnly(k)}
              className={`tap rounded-full px-3.5 py-[7px] text-[13px] font-semibold ${
                only === k ? 'bg-white text-[#1D1D1F] shadow-[0_1px_3px_rgba(0,0,0,.12)]' : 'text-black/45'
              }`}
            >
              {k === 'all' ? 'All' : k === 'low' ? 'Low' : 'Out'}
            </button>
          ))}
        </div>

        <div className="inline-flex rounded-full bg-black/[.055] p-[3px]">
          {([['card', 'Cards'], ['list', 'List']] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setView(k)}
              aria-pressed={view === k}
              className={`tap rounded-full px-3.5 py-[7px] text-[13px] font-semibold ${
                view === k ? 'bg-white text-[#1D1D1F] shadow-[0_1px_3px_rgba(0,0,0,.12)]' : 'text-black/45'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <PrimaryButton onClick={openNew}>+ Add product</PrimaryButton>
      </div>

      <div className="no-bar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {cats.map((c) => {
          const on = c === cat
          const t = tint(c)
          return (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`tap shrink-0 rounded-full px-3.5 py-[7px] text-[13px] font-bold transition ${
                on ? 'text-white' : 'text-black/55 hover:text-black/80'
              }`}
              style={{ background: on ? (c === 'All' ? '#1D1D1F' : t.dot) : 'rgba(0,0,0,.05)' }}
            >
              {c}
            </button>
          )
        })}
      </div>

      {colours.length > 1 && (
        <div className="no-bar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {colours.map((c) => {
            const on = c === colour
            return (
              <button
                key={c}
                onClick={() => setColour(c)}
                className={`tap flex shrink-0 items-center gap-1.5 rounded-full px-3 py-[6px] text-[12.5px] font-bold capitalize transition ${
                  on ? 'bg-[#1D1D1F] text-white' : 'bg-black/[.05] text-black/50 hover:bg-black/[.08]'
                }`}
              >
                {c !== 'All' && (
                  <span
                    className="h-[10px] w-[10px] rounded-full"
                    style={{ background: swatch(c)!, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.18)' }}
                  />
                )}
                {c}
              </button>
            )
          })}
        </div>
      )}

      <p className="text-[12.5px] font-semibold text-black/35">
        {list.length} of {products.length} products
      </p>

      {list.length === 0 ? (
        <EmptyState title="Nothing matches that" body="Try a different search, or clear the filters to see the full catalog." />
      ) : view === 'card' ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((p) => (
            <article key={p.id} className="card-soft fadeup flex flex-col gap-3 p-4">
              <div className="flex items-start gap-3">
                <Thumb p={p} size={58} />
                <div className="min-w-0 flex-1">
                  <h3 className="text-[14.5px] font-bold capitalize leading-snug text-[#1D1D1F]">
                    {p.base ?? p.name}
                  </h3>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {p.color && <ColorChip color={p.color} />}
                    {p.model && <ModelChip model={p.model} />}
                    <StatusPill qty={p.qty} />
                  </div>
                  <div className="mt-1.5">
                    <CategoryChip cat={p.category} />
                  </div>
                </div>
                <MoreMenu p={p} onEdit={() => openEdit(p)} onRemove={() => setRemoving(p)} />
              </div>

              <div className="flex items-center justify-between rounded-[14px] bg-[#F7F7FA] px-3.5 py-3">
                <div>
                  <StockNumber qty={p.qty} size="lg" />
                  <div className="num mt-1 text-[13px] font-bold text-black/55">
                    {p.price ? kyat(p.price) : <span className="text-black/25">No price set</span>}
                  </div>
                </div>
                <Stepper p={p} />
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="card-soft fadeup overflow-hidden">
          <ul className="divide-y divide-black/[.055]">
            {list.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap sm:px-5">
                <Thumb p={p} size={44} />
                <div className="min-w-0 flex-1 basis-[45%]">
                  <div className="truncate text-[14.5px] font-bold capitalize text-[#1D1D1F]">
                    {p.base ?? p.name}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {p.color && <ColorChip color={p.color} />}
                    {p.model && <ModelChip model={p.model} />}
                    <CategoryChip cat={p.category} className="hidden sm:inline-flex" />
                    <span className="num text-[12.5px] font-bold text-black/45">
                      {p.price ? kyat(p.price) : 'No price set'}
                    </span>
                  </div>
                </div>
                <StatusPill qty={p.qty} className="hidden lg:inline-flex" />
                <div className="w-[92px] shrink-0 text-right"><StockNumber qty={p.qty} /></div>
                <Stepper p={p} />
                <MoreMenu p={p} onEdit={() => openEdit(p)} onRemove={() => setRemoving(p)} />
              </li>
            ))}
          </ul>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-[26px] border-none p-6 sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="text-[20px] font-extrabold tracking-tight">
              {editing ? 'Edit product' : 'Add a product'}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-2 space-y-3.5">
            <Field label="Product name">
              <input autoFocus className={inputCls} value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="e.g. Pro 11 M4 y-fold cover" />
            </Field>
            <Field label="Category">
              <select className={inputCls} value={draft.category}
                onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
                {cats.filter((c) => c !== 'All').map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Quantity">
                <input type="number" min={0} className={inputCls} value={draft.qty}
                  onChange={(e) => setDraft({ ...draft, qty: e.target.value })} />
              </Field>
              <Field label="Price (Ks)" hint="Leave blank if not set">
                <input type="number" min={0} className={inputCls} value={draft.price}
                  onChange={(e) => setDraft({ ...draft, price: e.target.value })} placeholder="45000" />
              </Field>
            </div>
          </div>
          <DialogFooter className="mt-5 gap-2 sm:justify-end">
            <GhostButton onClick={() => setOpen(false)}>Cancel</GhostButton>
            <PrimaryButton onClick={save} disabled={!draft.name.trim()}>
              {editing ? 'Save changes' : 'Add product'}
            </PrimaryButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
        <DialogContent className="rounded-[26px] border-none p-6 sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle className="text-[19px] font-extrabold tracking-tight">
              Remove “{removing?.name}”?
            </DialogTitle>
          </DialogHeader>
          <p className="text-[14px] font-medium leading-relaxed text-black/50">
            It leaves the catalog for good. Past sales of it stay in your records.
          </p>
          <DialogFooter className="mt-5 gap-2 sm:justify-end">
            <GhostButton onClick={() => setRemoving(null)}>Keep it</GhostButton>
            <button
              onClick={() => { actions.remove(removing!.id); setRemoving(null) }}
              className="tap rounded-full bg-[#E5484D] px-5 py-2.5 text-[14.5px] font-bold text-white hover:bg-[#D53F44]"
            >
              Remove
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
