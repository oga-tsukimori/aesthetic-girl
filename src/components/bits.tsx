import * as React from 'react'
import { cn } from '@/lib/utils'
import { STATUS_META, statusOf, swatch, tint } from '@/lib/shop'

export function Segmented<T extends string>({
  value, onChange, options,
}: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="inline-flex rounded-full bg-black/[.055] p-[3px]" role="tablist">
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(o.value)}
            className={cn(
              'tap rounded-full px-4 py-[7px] text-[13.5px] font-semibold tracking-tight',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B8A] focus-visible:ring-offset-2',
              on ? 'bg-white text-[#1D1D1F] shadow-[0_1px_3px_rgba(0,0,0,.12)]' : 'text-black/45 hover:text-black/70'
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export function StatusPill({ qty, className }: { qty: number; className?: string }) {
  const m = STATUS_META[statusOf(qty)]
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold', className)}
      style={{ background: m.bg, color: m.color }}
    >
      <span className="h-[6px] w-[6px] rounded-full" style={{ background: m.color }} />
      {m.label}
    </span>
  )
}

export function CategoryChip({ cat, className }: { cat: string; className?: string }) {
  const t = tint(cat)
  return (
    <span
      className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-[11.5px] font-semibold', className)}
      style={{ background: t.bg, color: t.fg }}
    >
      {cat}
    </span>
  )
}

/** Stock on hand, stated plainly — the number is the point. */
export function StockNumber({ qty, size = 'md' }: { qty: number; size?: 'md' | 'lg' }) {
  const m = STATUS_META[statusOf(qty)]
  const big = size === 'lg'
  return (
    <div className="flex items-baseline gap-1.5">
      <span
        className={cn('num font-extrabold leading-none tracking-[-.03em]', big ? 'text-[30px]' : 'text-[22px]')}
        style={{ color: m.color }}
      >
        {qty}
      </span>
      <span className={cn('font-bold text-black/35', big ? 'text-[12.5px]' : 'text-[11.5px]')}>
        {qty === 1 ? 'in stock' : qty === 0 ? 'left' : 'in stock'}
      </span>
    </div>
  )
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12.5px] font-semibold text-black/50">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11.5px] text-black/40">{hint}</span>}
    </label>
  )
}

export const inputCls =
  'w-full rounded-[14px] border border-black/[.09] bg-[#F7F7FA] px-3.5 py-2.5 text-[15px] font-medium ' +
  'placeholder:text-black/30 focus:border-transparent focus:bg-white focus:outline-none ' +
  'focus:ring-2 focus:ring-[#FF6B8A]/60 transition'

export function PrimaryButton({ className, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...p}
      className={cn(
        'tap rounded-full bg-[#FF6B8A] px-5 py-2.5 text-[14.5px] font-bold text-white',
        'hover:bg-[#FF5C7E]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B8A] focus-visible:ring-offset-2',
        'disabled:opacity-40',
        className
      )}
    />
  )
}

export function GhostButton({ className, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...p}
      className={cn(
        'tap rounded-full bg-black/[.05] px-4 py-2 text-[14px] font-semibold text-black/70 hover:bg-black/[.08]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20',
        className
      )}
    />
  )
}

export function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="card-soft px-4 py-3.5">
      <div className="text-[11.5px] font-semibold uppercase tracking-[.06em] text-black/35">{label}</div>
      <div className="num mt-1 text-[22px] font-extrabold leading-none" style={{ color: accent ?? '#1D1D1F' }}>
        {value}
      </div>
      {sub && <div className="mt-1 text-[12px] font-medium text-black/40">{sub}</div>}
    </div>
  )
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="card-soft flex flex-col items-center gap-1.5 px-6 py-14 text-center">
      <div className="text-[15px] font-bold text-black/70">{title}</div>
      <div className="max-w-xs text-[13.5px] font-medium text-black/40">{body}</div>
    </div>
  )
}

/** Month + year dropdowns, driven by whichever periods actually have records. */
export function MonthYearPicker({
  value, onChange, keys, label,
}: { value: string; onChange: (k: string) => void; keys: string[]; label?: string }) {
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December']
  const years = [...new Set(keys.map((k) => k.slice(0, 4)))].sort((a, b) => b.localeCompare(a))
  const [y, m] = value.split('-')
  const monthsInYear = keys.filter((k) => k.startsWith(y)).map((k) => k.slice(5)).sort()

  const sel =
    'tap appearance-none rounded-[14px] border border-black/[.09] bg-white py-2.5 pl-3.5 pr-9 ' +
    'text-[14.5px] font-bold text-[#1D1D1F] ' +
    'focus:outline-none focus:ring-2 focus:ring-[#FF6B8A]/60'

  const caret = (
    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-black/35">▾</span>
  )

  return (
    <div className="flex flex-wrap items-center gap-2">
      {label && <span className="text-[12.5px] font-semibold text-black/40">{label}</span>}
      <div className="relative">
        <select
          className={sel}
          value={m}
          aria-label="Month"
          onChange={(e) => onChange(`${y}-${e.target.value}`)}
        >
          {monthsInYear.map((mm) => (
            <option key={mm} value={mm}>{MONTHS[Number(mm) - 1]}</option>
          ))}
        </select>
        {caret}
      </div>
      <div className="relative">
        <select
          className={sel}
          value={y}
          aria-label="Year"
          onChange={(e) => {
            const ny = e.target.value
            const inYear = keys.filter((k) => k.startsWith(ny)).sort()
            const same = inYear.find((k) => k.slice(5) === m)
            onChange(same ?? inYear[inYear.length - 1])
          }}
        >
          {years.map((yy) => <option key={yy} value={yy}>{yy}</option>)}
        </select>
        {caret}
      </div>
    </div>
  )
}

/** Colour variant, shown as a dot plus its name. */
export function ColorChip({ color, className }: { color: string; className?: string }) {
  const hex = swatch(color)!
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 rounded-full bg-black/[.045] px-2 py-1 text-[11.5px] font-semibold capitalize text-black/60', className)}
    >
      <span
        className="h-[9px] w-[9px] rounded-full"
        style={{ background: hex, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.16)' }}
      />
      {color}
    </span>
  )
}

/** Which iPad or tablet this variant fits. */
export function ModelChip({ model, className }: { model: string; className?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full bg-[#EEF1F6] px-2 py-1 text-[11.5px] font-semibold text-[#4A5568]', className)}>
      {model}
    </span>
  )
}
