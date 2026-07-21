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
import { LayoutGrid, List as ListIcon, SlidersHorizontal, X } from 'lucide-react'

type Draft = { name: string; category: string; qty: string; price: string }
const blank: Draft = { name: '', category: 'iPad Cover', qty: '0', price: '' }
const normalizeModel = (model: string) =>
  model
    .replace(/["”]/g, '')
    .replace(/\s*,\s*/g, ', ')
    .replace(/\s*\/\s*/g, '/')
    .replace(/\s+/g, ' ')
    .trim()

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

export default function Products({
  products,
  actions,
  readOnly = false,
}: {
  products: Product[]
  actions: ProductActions
  readOnly?: boolean
}) {
  const [q, setQ] = React.useState('')
  const [cat, setCat] = React.useState('All')
  const [stock, setStock] = React.useState<'all' | 'out' | 'low' | 'in'>('all')
  const [sort, setSort] = React.useState<'name' | 'high' | 'low'>('name')
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
  const models = React.useMemo(() => {
    const unique = new Map<string, string>()
    for (const product of products) {
      if (product.category !== 'iPad Cover') continue
      const model = normalizeModel(product.model ?? '')
      if (model.toLowerCase() === '360 removable') continue
      if (model && !unique.has(model.toLowerCase())) unique.set(model.toLowerCase(), model)
    }
    return ['All', ...[...unique.values()].sort((a, b) => a.localeCompare(b))]
  }, [products])
  const [colour, setColour] = React.useState('All')
  const [model, setModel] = React.useState('All')

  const list = products
    .filter((p) => {
      if (cat !== 'All' && p.category !== cat) return false
      if (colour !== 'All' && p.color !== colour) return false
      if (model !== 'All' && normalizeModel(p.model ?? '').toLowerCase() !== model.toLowerCase()) return false
      if (stock !== 'all' && statusOf(p.qty) !== stock) return false
      return p.name.toLowerCase().includes(q.toLowerCase().trim())
    })
    .sort((a, b) =>
      sort === 'high' ? b.qty - a.qty : sort === 'low' ? a.qty - b.qty : 0
    )

  const activeFilters =
    (model !== 'All' ? 1 : 0) +
    (colour !== 'All' ? 1 : 0) +
    (stock !== 'all' ? 1 : 0) +
    (sort !== 'name' ? 1 : 0)
  const clearFilters = () => { setModel('All'); setColour('All'); setStock('all'); setSort('name') }

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
    readOnly ? null :
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
        <div className="relative min-w-[170px] flex-1">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search products"
            className={inputCls + ' pl-9'}
          />
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[14px] text-black/30">⌕</span>
        </div>

        {/* category picker */}
        <div className="relative">
          <select
            value={cat}
            onChange={(e) => setCat(e.target.value)}
            aria-label="Product category"
            className="tap appearance-none rounded-[14px] border border-black/[.09] bg-white py-2.5 pl-3.5 pr-9 text-[14px] font-bold text-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-[#89288F]/60"
          >
            {cats.map((c) => (
              <option key={c} value={c}>{c === 'All' ? 'All products' : c}</option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-black/35">▾</span>
        </div>

        {/* filters */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              className={`tap flex items-center gap-2 rounded-[14px] border px-3.5 py-2.5 text-[14px] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#89288F]/60 ${
                activeFilters
                  ? 'border-transparent bg-[#89288F] text-white'
                  : 'border-black/[.09] bg-white text-[#1D1D1F]'
              }`}
            >
              <SlidersHorizontal size={15} strokeWidth={2.6} />
              Filter
              {activeFilters > 0 && (
                <span className="num grid h-[18px] min-w-[18px] place-items-center rounded-full bg-white/25 px-1 text-[11px] font-extrabold">
                  {activeFilters}
                </span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            sideOffset={8}
            className="w-[300px] rounded-[20px] border-none p-4 shadow-[0_18px_50px_-16px_rgba(20,20,30,.32)]"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[13px] font-extrabold tracking-tight">Filters</span>
              {activeFilters > 0 && (
                <button
                  onClick={clearFilters}
                  className="tap flex items-center gap-1 text-[12px] font-bold text-[#89288F] hover:underline"
                >
                  <X size={12} strokeWidth={3} /> Clear
                </button>
              )}
            </div>

            <div className="mb-3.5">
              <span className="mb-1.5 block text-[11.5px] font-bold uppercase tracking-[.06em] text-black/35">
                Stock
              </span>
              <div className="grid grid-cols-4 gap-1.5">
                {([['all', 'Any'], ['in', 'In'], ['low', 'Low'], ['out', 'Out']] as const).map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => setStock(k)}
                    className={`tap rounded-[11px] py-1.5 text-[12.5px] font-bold ${
                      stock === k ? 'bg-[#1D1D1F] text-white' : 'bg-black/[.05] text-black/55 hover:bg-black/[.08]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-3.5">
              <span className="mb-1.5 block text-[11.5px] font-bold uppercase tracking-[.06em] text-black/35">
                Sort by stock
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {([['name', 'Default'], ['high', 'High → low'], ['low', 'Low → high']] as const).map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => setSort(k)}
                    className={`tap rounded-[11px] py-1.5 text-[12px] font-bold ${
                      sort === k ? 'bg-[#1D1D1F] text-white' : 'bg-black/[.05] text-black/55 hover:bg-black/[.08]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {models.length > 1 && (
              <div className="mb-3.5">
                <span className="mb-1.5 block text-[11.5px] font-bold uppercase tracking-[.06em] text-black/35">
                  iPad model
                </span>
                <div className="max-h-[154px] overflow-y-auto pr-1">
                  <div className="flex flex-wrap gap-1.5">
                    {models.map((option) => (
                      <button
                        key={option}
                        onClick={() => setModel(option)}
                        className={`tap rounded-full px-2.5 py-1.5 text-[12px] font-bold ${
                          option === model
                            ? 'bg-[#1D1D1F] text-white'
                            : 'bg-black/[.05] text-black/55 hover:bg-black/[.08]'
                        }`}
                      >
                        {option === 'All' ? 'Any model' : option}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {colours.length > 1 && (
              <div>
                <span className="mb-1.5 block text-[11.5px] font-bold uppercase tracking-[.06em] text-black/35">
                  Colour
                </span>
                <div className="max-h-[184px] overflow-y-auto pr-1">
                  <div className="flex flex-wrap gap-1.5">
                    {colours.map((c) => {
                      const on = c === colour
                      return (
                        <button
                          key={c}
                          onClick={() => setColour(c)}
                          className={`tap flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12px] font-bold capitalize ${
                            on ? 'bg-[#1D1D1F] text-white' : 'bg-black/[.05] text-black/55 hover:bg-black/[.08]'
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
                </div>
              </div>
            )}
          </PopoverContent>
        </Popover>

        {/* view: icons only */}
        <div className="inline-flex rounded-full bg-black/[.055] p-[3px]">
          {([['card', LayoutGrid, 'Card view'], ['list', ListIcon, 'List view']] as const).map(([k, Icon, label]) => (
            <button
              key={k}
              onClick={() => setView(k)}
              aria-pressed={view === k}
              aria-label={label}
              title={label}
              className={`tap grid h-[34px] w-[38px] place-items-center rounded-full ${
                view === k ? 'bg-white text-[#1D1D1F] shadow-[0_1px_3px_rgba(0,0,0,.12)]' : 'text-black/40'
              }`}
            >
              <Icon size={17} strokeWidth={2.4} />
            </button>
          ))}
        </div>

        {!readOnly && <PrimaryButton onClick={openNew}>+ Add product</PrimaryButton>}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[12.5px] font-semibold text-black/35">
          {list.length} of {products.length} products
        </p>
        {model !== 'All' && (
          <button onClick={() => setModel('All')}
            className="tap flex items-center gap-1.5 rounded-full bg-black/[.05] px-2.5 py-1 text-[11.5px] font-bold text-black/55">
            {model}
            <X size={11} strokeWidth={3} />
          </button>
        )}
        {colour !== 'All' && (
          <button onClick={() => setColour('All')}
            className="tap flex items-center gap-1.5 rounded-full bg-black/[.05] px-2.5 py-1 text-[11.5px] font-bold capitalize text-black/55">
            <span className="h-[9px] w-[9px] rounded-full"
              style={{ background: swatch(colour)!, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.18)' }} />
            {colour}
            <X size={11} strokeWidth={3} />
          </button>
        )}
        {stock !== 'all' && (
          <button onClick={() => setStock('all')}
            className="tap flex items-center gap-1.5 rounded-full bg-black/[.05] px-2.5 py-1 text-[11.5px] font-bold text-black/55">
            {stock === 'in' ? 'In stock' : stock === 'low' ? 'Low stock' : 'Out of stock'}
            <X size={11} strokeWidth={3} />
          </button>
        )}
        {sort !== 'name' && (
          <button onClick={() => setSort('name')}
            className="tap flex items-center gap-1.5 rounded-full bg-black/[.05] px-2.5 py-1 text-[11.5px] font-bold text-black/55">
            Stock {sort === 'high' ? 'high → low' : 'low → high'}
            <X size={11} strokeWidth={3} />
          </button>
        )}
      </div>

      {list.length === 0 ? (
        <EmptyState title="Nothing matches that" body="Try a different search, or clear the filters to see the full catalog." />
      ) : view === 'card' ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((p) => (
            <article key={p.id} className="card-soft fadeup flex min-w-0 flex-col gap-3 p-4">
              <div className="flex min-w-0 items-start gap-3">
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
                {!readOnly && <MoreMenu p={p} onEdit={() => openEdit(p)} onRemove={() => setRemoving(p)} />}
              </div>

              <div className="flex min-w-0 items-center justify-between gap-2 rounded-[14px] bg-[#F7F7FA] px-3.5 py-3">
                <div className="min-w-0">
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
                {!readOnly && <MoreMenu p={p} onEdit={() => openEdit(p)} onRemove={() => setRemoving(p)} />}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Dialog open={!readOnly && open} onOpenChange={setOpen}>
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

      <Dialog open={!readOnly && !!removing} onOpenChange={(o) => !o && setRemoving(null)}>
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
