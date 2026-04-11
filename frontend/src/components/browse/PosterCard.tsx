import { motion } from 'framer-motion'

import type { Product } from '../../types/product'

type Props = {
  product: Product | undefined
  subtitle?: string
  meta?: string
  onOpen?: () => void
  onSelect?: () => void
  /** Phase 10: authenticated save toggle */
  saved?: boolean
  onToggleSave?: () => void
  saveDisabled?: boolean
}

export function PosterCard({
  product,
  subtitle,
  meta,
  onOpen,
  onSelect,
  saved = false,
  onToggleSave,
  saveDisabled = false,
}: Props) {
  const title = product?.title ?? 'Unknown'
  const cat = product?.category ?? ''

  return (
    <motion.article
      layout
      whileHover={{ scale: 1.03, y: -4 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      className="group relative w-[min(100%,292px)] shrink-0 snap-start overflow-hidden rounded-[20px] border border-[var(--es-border)] bg-[var(--es-surface-2)] shadow-[var(--es-shadow-card)]"
    >
      {onToggleSave ? (
        <button
          type="button"
          disabled={saveDisabled}
          title={saved ? 'Remove from saved' : 'Save to list'}
          onClick={(e) => {
            e.stopPropagation()
            e.preventDefault()
            onToggleSave()
          }}
          className="absolute left-2 top-2 z-10 rounded-md border border-white/20 bg-black/60 px-2 py-1 text-xs text-white backdrop-blur-sm hover:bg-black/80 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saved ? 'Saved' : 'Save'}
        </button>
      ) : null}
      <button
        type="button"
        onClick={onSelect}
        className="block w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--es-accent)]"
      >
        <div className="relative aspect-[16/9] w-full bg-[linear-gradient(160deg,#20283a_0%,#0d1018_52%,#05060a_100%)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,138,61,0.22),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(229,9,20,0.22),_transparent_30%)]" />
          <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-white/10 to-transparent opacity-70" />
          <div className="absolute inset-0 flex items-end p-3">
            <div>
              <p className="mb-2 inline-flex rounded-full border border-white/10 bg-black/30 px-2 py-1 text-[10px] uppercase tracking-[0.28em] text-zinc-300">
                {cat || 'Catalog'}
              </p>
              <p className="es-display line-clamp-2 text-sm font-semibold tracking-tight text-white md:text-base">
                {title}
              </p>
              {subtitle && (
                <p className="mt-1 text-xs text-zinc-400">{subtitle}</p>
              )}
            </div>
          </div>
        </div>
        <div className="border-t border-[var(--es-border)] bg-black/30 px-3 py-3 backdrop-blur-[var(--es-backdrop)]">
          <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            Signal summary
          </p>
          {meta && (
            <p className="mt-1 font-mono text-xs text-emerald-400/90">{meta}</p>
          )}
        </div>
      </button>
      {onOpen && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onOpen()
          }}
          className="absolute right-2 top-2 rounded-md bg-black/55 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-white opacity-0 transition group-hover:opacity-100"
        >
          Details
        </button>
      )}
    </motion.article>
  )
}
