import { motion } from 'framer-motion'

import { ContentRail } from '../components/browse/ContentRail'
import { PosterCard } from '../components/browse/PosterCard'
import { TemplatePanel } from '../components/template/TemplatePanel'
import { TemplateStat } from '../components/template/TemplateStat'
import type { AnalyticsSource } from '../types/analytics'
import type {
  ColdStartRecommendationResponse,
  CollaborativeRecommendationResponse,
  ContentRecommendationResponse,
  HybridRecommendationResponse,
  Product,
} from '../types/product'

type Props = {
  products: Product[]
  byId: Map<string, Product>
  heroProduct: Product | undefined
  productsError: string | null
  catalogQ: string
  catalogCategory: string
  onCatalogQChange: (value: string) => void
  onCatalogCategoryChange: (value: string) => void
  onSearch: () => void
  onClear: () => void
  onPlayHero: () => void
  onShuffleHero: () => void
  onSelectProduct: (productId: string, source: AnalyticsSource) => void
  coldStartRec: ColdStartRecommendationResponse | null
  contentRec: ContentRecommendationResponse | null
  hybridRec: HybridRecommendationResponse | null
  cfRec: CollaborativeRecommendationResponse | null
  recLoading: boolean
  savedIds: Set<string>
  canSave: boolean
  saveBusy: boolean
  onToggleSave: (productId: string, isSaved: boolean) => void
}

function saveHandler(
  canSave: boolean,
  productId: string,
  isSaved: boolean,
  onToggleSave: (productId: string, isSaved: boolean) => void,
) {
  if (!canSave) return undefined
  return () => onToggleSave(productId, isSaved)
}

export function DiscoverPage({
  products,
  byId,
  heroProduct,
  productsError,
  catalogQ,
  catalogCategory,
  onCatalogQChange,
  onCatalogCategoryChange,
  onSearch,
  onClear,
  onPlayHero,
  onShuffleHero,
  onSelectProduct,
  coldStartRec,
  contentRec,
  hybridRec,
  cfRec,
  recLoading,
  savedIds,
  canSave,
  saveBusy,
  onToggleSave,
}: Props) {
  const catalogHighlights = products.slice(0, 8)

  return (
    <div className="space-y-8">
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(225,29,72,0.26),rgba(15,23,42,0.92)_55%,rgba(10,12,20,1)_100%)] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.38)] md:p-8"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.16),_transparent_28%)]" />
        <div className="relative grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-red-200/80">
              Featured title
            </p>
            <h2 className="es-display mt-3 text-4xl font-bold tracking-tight text-white md:text-5xl">
              {heroProduct?.title ?? 'Find the next strong recommendation'}
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-200/85">
              {heroProduct?.description?.slice(0, 240) ??
                'Explore cold-start, content, and hybrid ranking side by side. The discover page keeps the strongest recommendation rails front and center while search stays lightweight.'}
              {heroProduct?.description && heroProduct.description.length > 240 ? '...' : ''}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={onPlayHero}
                className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-zinc-950 hover:brightness-95"
              >
                Play preview
              </button>
              <button
                type="button"
                onClick={onShuffleHero}
                className="rounded-full border border-white/15 bg-white/8 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/12"
              >
                Shuffle hero
              </button>
            </div>
          </div>

          <div className="grid gap-3 self-end rounded-[26px] border border-white/10 bg-black/25 p-4 text-sm text-zinc-200">
            <div className="rounded-[24px] border border-white/10 bg-white/6 p-4">
              <p className="text-[11px] uppercase tracking-[0.25em] text-zinc-500">
                Hybrid strategy
              </p>
              <p className="mt-2 es-display text-2xl text-white">
                {hybridRec?.strategy ?? 'warming up'}
              </p>
              <p className="mt-2 text-sm text-zinc-400">
                Cold-start fallback is preserved for empty-history users, while returning users still get the blended ranking path.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <TemplateStat
                label="Search results"
                value={products.length.toString()}
                detail="Filtered catalog matches"
                tone="neutral"
              />
              <TemplateStat
                label="Hero category"
                value={heroProduct?.category || 'Catalog'}
                detail="Current featured focus"
                tone="amber"
              />
            </div>
          </div>
        </div>
      </motion.section>

      <TemplatePanel
        title="Find titles fast"
        eyebrow="Search Template"
        description="Search stays lightweight, but the layout keeps it visually anchored so the recommendation rails remain the main event."
        accent="neutral"
      >
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.3em] text-zinc-500">
              Search catalog
            </label>
            <input
              value={catalogQ}
              onChange={(event) => onCatalogQChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') onSearch()
              }}
              placeholder="Search title or description"
              className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none focus:border-red-300/60"
            />
          </div>
          <div className="w-full sm:w-52">
            <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.3em] text-zinc-500">
              Category
            </label>
            <input
              value={catalogCategory}
              onChange={(event) => onCatalogCategoryChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') onSearch()
              }}
              placeholder="Exact match"
              className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none focus:border-red-300/60"
            />
          </div>
          <button
            type="button"
            onClick={onSearch}
            className="rounded-full bg-[var(--es-accent)] px-5 py-3 text-xs font-semibold uppercase tracking-[0.25em] text-white hover:brightness-110"
          >
            Search
          </button>
          <button
            type="button"
            onClick={onClear}
            className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-xs font-semibold uppercase tracking-[0.25em] text-zinc-300 hover:bg-white/10"
          >
            Clear
          </button>
        </div>
        {productsError ? <p className="mt-3 text-sm text-red-300">{productsError}</p> : null}
      </TemplatePanel>

      <TemplatePanel
        title="Signal board"
        eyebrow="At a glance"
        description="A compact template strip that tells you what the current page is optimizing for before you dive into the rails."
        accent="sky"
      >
        <div className="grid gap-3 md:grid-cols-3">
          <TemplateStat
            label="Trending rail"
            value={coldStartRec?.items.length ? 'ready' : 'loading'}
            detail="Cold-start and fallback momentum"
            tone="sky"
          />
          <TemplateStat
            label="Content rail"
            value={recLoading ? 'working' : contentRec?.items.length ? 'ready' : 'idle'}
            detail="Hero similarity neighbors"
            tone="violet"
          />
          <TemplateStat
            label="Hybrid rail"
            value={hybridRec?.items.length ? 'ready' : 'warming'}
            detail="Collaborative plus content blend"
            tone="red"
          />
        </div>
      </TemplatePanel>

      <ContentRail
        title="Trending now"
        description="Time-decayed interaction momentum for cold-start users and fallback recommendations."
      >
        {coldStartRec?.items.map((item) => (
          <PosterCard
            key={item.product_id}
            product={byId.get(item.product_id)}
            meta={`score ${item.score.toFixed(2)}`}
            saved={savedIds.has(item.product_id)}
            saveDisabled={saveBusy}
            onToggleSave={saveHandler(
              canSave,
              item.product_id,
              savedIds.has(item.product_id),
              onToggleSave,
            )}
            onSelect={() => onSelectProduct(item.product_id, 'cold_start')}
          />
        ))}
      </ContentRail>

      <ContentRail
        title="Because you viewed this"
        description="Content similarity keeps the current hero title anchored while you scan nearby options."
      >
        {recLoading ? (
          <p className="px-4 text-sm text-zinc-500">Loading similar titles...</p>
        ) : (
          contentRec?.items.map((item) => (
            <PosterCard
              key={item.product_id}
              product={byId.get(item.product_id)}
              meta={`match ${(item.score * 100).toFixed(0)}%`}
              saved={savedIds.has(item.product_id)}
              saveDisabled={saveBusy}
              onToggleSave={saveHandler(
                canSave,
                item.product_id,
                savedIds.has(item.product_id),
                onToggleSave,
              )}
              onSelect={() => onSelectProduct(item.product_id, 'content')}
            />
          ))
        )}
      </ContentRail>

      <ContentRail
        title="Top picks for you"
        description="Hybrid ranking blends collaborative score normalization with content affinity."
      >
        {hybridRec?.items.map((item) => (
          <PosterCard
            key={item.product_id}
            product={byId.get(item.product_id)}
            meta={`hybrid ${item.hybrid_score.toFixed(2)}`}
            saved={savedIds.has(item.product_id)}
            saveDisabled={saveBusy}
            onToggleSave={saveHandler(
              canSave,
              item.product_id,
              savedIds.has(item.product_id),
              onToggleSave,
            )}
            onSelect={() => onSelectProduct(item.product_id, 'hybrid')}
          />
        ))}
      </ContentRail>

      <ContentRail
        title="Collaborative (SVD)"
        description="Pure collaborative ranking remains visible so you can compare it against the blended rail."
      >
        {cfRec?.items.map((item) => (
          <PosterCard
            key={item.product_id}
            product={byId.get(item.product_id)}
            meta={`est ${item.estimated_rating.toFixed(2)}`}
            saved={savedIds.has(item.product_id)}
            saveDisabled={saveBusy}
            onToggleSave={saveHandler(
              canSave,
              item.product_id,
              savedIds.has(item.product_id),
              onToggleSave,
            )}
            onSelect={() => onSelectProduct(item.product_id, 'collaborative')}
          />
        ))}
      </ContentRail>

      <TemplatePanel
        title="Catalog highlights"
        eyebrow="Curated Grid"
        description="Filtered matches stay below the recommendation rails so search never derails discovery."
        accent="amber"
        actions={
          <p className="text-xs uppercase tracking-[0.25em] text-zinc-500">
            {products.length} matches
          </p>
        }
      >
        {catalogHighlights.length ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {catalogHighlights.map((product) => (
              <PosterCard
                key={product.id}
                product={product}
                subtitle={product.tags.slice(0, 2).join(' / ') || undefined}
                meta={
                  product.price == null ? 'price unavailable' : `$${product.price.toFixed(2)}`
                }
                saved={savedIds.has(product.id)}
                saveDisabled={saveBusy}
                onToggleSave={saveHandler(
                  canSave,
                  product.id,
                  savedIds.has(product.id),
                  onToggleSave,
                )}
                onSelect={() => onSelectProduct(product.id, 'catalog')}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-zinc-500">
            No catalog matches yet. Try a broader query or clear the filters.
          </p>
        )}
      </TemplatePanel>
    </div>
  )
}
