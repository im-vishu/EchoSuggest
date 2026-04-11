import { PosterCard } from '../components/browse/PosterCard'
import type { UserPublic } from '../types/auth'
import type { Product } from '../types/product'

type Props = {
  user: UserPublic | null
  savedProducts: Product[]
  fallbackProducts: Product[]
  savedIds: Set<string>
  saveBusy: boolean
  onToggleSave: (productId: string, isSaved: boolean) => void
  onSelectProduct: (productId: string) => void
}

export function SavedPage({
  user,
  savedProducts,
  fallbackProducts,
  savedIds,
  saveBusy,
  onToggleSave,
  onSelectProduct,
}: Props) {
  const recommendations = fallbackProducts.slice(0, 6)

  if (!user) {
    return (
      <section className="rounded-[28px] border border-white/10 bg-[rgba(13,16,24,0.88)] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.28)]">
        <h2 className="es-display text-3xl font-semibold text-white">Saved list needs a session</h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-400">
          Sign in from the header to persist saved products in MongoDB and reuse your account id for recommendation rails.
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {recommendations.map((product) => (
            <PosterCard
              key={product.id}
              product={product}
              subtitle={product.tags.slice(0, 2).join(' · ') || undefined}
              meta={product.category || 'Catalog'}
              onSelect={() => onSelectProduct(product.id)}
            />
          ))}
        </div>
      </section>
    )
  }

  return (
    <div className="space-y-8">
      <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(190,24,93,0.18),rgba(13,16,24,0.92))] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.28)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-pink-200/80">
          Watchlist
        </p>
        <h2 className="es-display mt-3 text-3xl font-semibold text-white">
          {savedProducts.length ? `${savedProducts.length} saved titles` : 'Your list is empty'}
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-300">
          Saved titles are stored per user and stay available across sessions. Use this page as your short-term memory while tuning recommendation quality.
        </p>
      </section>

      {savedProducts.length ? (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {savedProducts.map((product) => (
            <PosterCard
              key={product.id}
              product={product}
              subtitle={product.tags.slice(0, 2).join(' · ') || undefined}
              meta={product.category || 'Catalog'}
              saved={savedIds.has(product.id)}
              saveDisabled={saveBusy}
              onToggleSave={() => onToggleSave(product.id, true)}
              onSelect={() => onSelectProduct(product.id)}
            />
          ))}
        </section>
      ) : (
        <section className="rounded-[28px] border border-dashed border-white/15 bg-[rgba(13,16,24,0.82)] p-6">
          <p className="text-sm text-zinc-400">
            Save a few titles from Discover to build up a personal shortlist.
          </p>
        </section>
      )}

      <section className="rounded-[28px] border border-white/10 bg-[rgba(13,16,24,0.88)] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.28)]">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="es-display text-2xl font-semibold text-white">Quick return picks</h3>
            <p className="mt-1 text-sm text-zinc-400">
              A lightweight fallback strip so the saved page still gives you somewhere useful to jump next.
            </p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {recommendations.map((product) => (
            <PosterCard
              key={product.id}
              product={product}
              subtitle={product.tags.slice(0, 2).join(' · ') || undefined}
              meta={product.price == null ? 'price unavailable' : `$${product.price.toFixed(2)}`}
              saved={savedIds.has(product.id)}
              saveDisabled={saveBusy}
              onToggleSave={() => onToggleSave(product.id, savedIds.has(product.id))}
              onSelect={() => onSelectProduct(product.id)}
            />
          ))}
        </div>
      </section>
    </div>
  )
}
