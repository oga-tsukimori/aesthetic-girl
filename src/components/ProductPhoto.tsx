import type { Product } from '@/data'
import { PHOTOS } from '@/data'
import { kyat, tint } from '@/lib/shop'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ZoomIn } from 'lucide-react'

function productPhotoSrc(product: Product) {
  return product.photo ? PHOTOS[product.photo] ?? null : null
}

export function ProductThumb({
  product,
  size,
  onPreview,
}: {
  product: Product
  size: number
  onPreview?: (product: Product) => void
}) {
  const src = productPhotoSrc(product)
  const color = tint(product.category)

  const image = src ? (
    <img
      src={src}
      alt={product.name}
      loading="lazy"
      className="h-full w-full object-cover"
      style={{ background: color.bg }}
    />
  ) : (
    <span
      className="grid h-full w-full place-items-center text-[15px] font-black uppercase"
      style={{ background: color.bg, color: color.fg }}
      aria-hidden
    >
      {(product.base ?? product.name).slice(0, 2)}
    </span>
  )

  if (!src || !onPreview) {
    return (
      <span
        className="block shrink-0 overflow-hidden rounded-[14px]"
        style={{ width: size, height: size }}
      >
        {image}
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={() => onPreview(product)}
      aria-label={`View a larger photo of ${product.name}`}
      className="tap group relative block shrink-0 overflow-hidden rounded-[14px] ring-1 ring-black/[.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#89288F]"
      style={{ width: size, height: size }}
    >
      {image}
      <span className="absolute inset-0 grid place-items-center bg-black/0 text-white opacity-0 transition group-hover:bg-black/25 group-hover:opacity-100 group-focus-visible:bg-black/25 group-focus-visible:opacity-100">
        <ZoomIn size={Math.max(15, Math.round(size * 0.3))} strokeWidth={2.5} aria-hidden />
      </span>
    </button>
  )
}

export function ProductPhotoViewer({
  product,
  onClose,
}: {
  product: Product | null
  onClose: () => void
}) {
  const src = product ? productPhotoSrc(product) : null

  return (
    <Dialog open={Boolean(product && src)} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="z-[70] w-[calc(100%_-_24px)] max-w-[760px] gap-3 rounded-[24px] border-none bg-white p-3 shadow-[0_24px_80px_-20px_rgba(0,0,0,.55)] sm:p-4">
        {product && src && (
          <>
            <DialogHeader className="px-1 pt-1 pr-10 text-left">
              <DialogTitle className="text-[16px] font-extrabold capitalize leading-snug text-[#1D1D1F]">
                {product.name}
              </DialogTitle>
              <p className="text-[12.5px] font-semibold text-black/45">
                {product.category}
                {product.price != null ? ` · ${kyat(product.price)} each` : ''}
              </p>
            </DialogHeader>
            <div className="grid max-h-[76vh] place-items-center overflow-hidden rounded-[18px] bg-[#F7F7FA]">
              <img
                src={src}
                alt={product.name}
                className="max-h-[76vh] w-full object-contain"
              />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
