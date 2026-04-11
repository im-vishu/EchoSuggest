import { motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { ContentRail } from '../components/browse/ContentRail'
import { PosterCard } from '../components/browse/PosterCard'
import { trackEvent } from '../lib/analytics'
import { api } from '../lib/api'
import { useAuthStore } from '../stores/authStore'
import { useStatusStore } from '../stores/statusStore'
import type { MetricsSummaryResponse } from '../types/analytics'
import type {
  ColdStartRecommendationResponse,
  CollaborativeRecommendationResponse,
  ContentRecommendationResponse,
  HybridRecommendationResponse,
  PrecisionAtKReport,
  Product,
} from '../types/product'
import type { SavedListResponse } from '../types/saved'

function productMap(list: Product[]) {
  return new Map(list.map((p) => [p.id, p]))
}

export default function BrowsePage() {
  const { health, dbPing, loading, error, fetchAll } = useStatusStore()
  const {
    user,
    authError,
    busy: authBusy,
    login,
    register,
    logout,
    fetchMe,
    hydrateToken,
  } = useAuthStore()
  const [products, setProducts] = useState<Product[]>([])
  const [productsError, setProductsError] = useState<string | null>(null)
  const [heroId, setHeroId] = useState<string | null>(null)
  const [profileId, setProfileId] = useState('demo-alice')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authName, setAuthName] = useState('')
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [catalogQ, setCatalogQ] = useState('')
  const [catalogCategory, setCatalogCategory] = useState('')
  const [savedIds, setSavedIds] = useState<Set<string>>(() => new Set())
  const [savedProducts, setSavedProducts] = useState<Product[]>([])
  const [saveBusy, setSaveBusy] = useState(false)

  const [coldStartRec, setColdStartRec] =
    useState<ColdStartRecommendationResponse | null>(null)
  const [hybridRec, setHybridRec] =
    useState<HybridRecommendationResponse | null>(null)
  const [cfRec, setCfRec] = useState<CollaborativeRecommendationResponse | null>(
    null,
  )
  const [contentRec, setContentRec] =
    useState<ContentRecommendationResponse | null>(null)
  const [recLoading, setRecLoading] = useState(false)
  const [metrics, setMetrics] = useState<MetricsSummaryResponse | null>(null)
  const [pAtK, setPAtK] = useState<PrecisionAtKReport | null>(null)
  const [pAtKLoading, setPAtKLoading] = useState(false)
  const [precomputeBusy, setPrecomputeBusy] = useState(false)
  const impressionKeysRef = useRef<Set<string>>(new Set())

  const byId = useMemo(() => productMap(products), [products])

  const loadProducts = useCallback(async () => {
    setProductsError(null)
    try {
      const params: Record<string, string> = { limit: '80' }
      const q = catalogQ.trim()
      const cat = catalogCategory.trim()
      if (q) params.q = q
      if (cat) params.category = cat
      const res = await api.get<Product[]>('/api/v1/products', { params })
      setProducts(res.data)
      setHeroId((prev) => {
        if (prev && res.data.some((product) => product.id === prev)) {
          return prev
        }
        return res.data[0]?.id ?? null
      })
    } catch (e) {
      setProductsError(e instanceof Error ? e.message : 'Failed to load products')
    }
  }, [catalogQ, catalogCategory])

  const trackImpressionBatch = useCallback(
    (
      source: 'cold_start' | 'hybrid' | 'collaborative' | 'content',
      productIds: string[],
    ) => {
      for (const productId of productIds) {
        const dedupeKey = `${profileId}:${source}:${productId}`
        if (impressionKeysRef.current.has(dedupeKey)) continue
        impressionKeysRef.current.add(dedupeKey)
        void trackEvent({
          user_id: profileId,
          product_id: productId,
          event_type: 'impression',
          source,
        })
      }
    },
    [profileId],
  )

  const fetchSaved = useCallback(async () => {
    if (!user) {
      setSavedIds(new Set())
      setSavedProducts([])
      return
    }
    try {
      const res = await api.get<SavedListResponse>('/api/v1/me/saved', {
        params: { expand: true, limit: 100 },
      })
      setSavedIds(new Set(res.data.items.map((i) => i.product_id)))
      setSavedProducts(res.data.products)
    } catch {
      setSavedIds(new Set())
      setSavedProducts([])
    }
  }, [user])

  const toggleSave = useCallback(
    async (productId: string, isSaved: boolean) => {
      if (!user) return
      setSaveBusy(true)
      try {
        if (isSaved) {
          await api.delete(
            `/api/v1/me/saved/${encodeURIComponent(productId)}`,
          )
        } else {
          await api.post('/api/v1/me/saved', { product_id: productId })
        }
        await fetchSaved()
      } finally {
        setSaveBusy(false)
      }
    },
    [user, fetchSaved],
  )

  useEffect(() => {
    void fetchAll()
  }, [fetchAll])

  useEffect(() => {
    hydrateToken()
    void fetchMe()
  }, [hydrateToken, fetchMe])

  useEffect(() => {
    void fetchSaved()
  }, [fetchSaved])

  useEffect(() => {
    if (!loading && !error) void loadProducts()
  }, [loading, error, loadProducts])

  useEffect(() => {
    api
      .get<ColdStartRecommendationResponse>('/api/v1/recommendations/cold-start', {
        params: { top_k: 12, mode: 'trending', window_days: 30 },
      })
      .then((res) => setColdStartRec(res.data))
      .catch(() => setColdStartRec(null))
  }, [products.length])

  useEffect(() => {
    if (!heroId) {
      setContentRec(null)
      return
    }
    let c = false
    setRecLoading(true)
    api
      .get<ContentRecommendationResponse>(
        `/api/v1/recommendations/content/${heroId}`,
        { params: { top_k: 12 } },
      )
      .then((r) => {
        if (!c) setContentRec(r.data)
      })
      .finally(() => {
        if (!c) setRecLoading(false)
      })
    return () => {
      c = true
    }
  }, [heroId])

  useEffect(() => {
    if (!profileId.trim()) {
      setCfRec(null)
      return
    }
    let c = false
    const uid = encodeURIComponent(profileId.trim())
    api
      .get<CollaborativeRecommendationResponse>(
        `/api/v1/recommendations/collaborative/${uid}`,
        { params: { top_k: 12 } },
      )
      .then((r) => {
        if (!c) setCfRec(r.data)
      })
      .catch(() => {
        if (!c) setCfRec(null)
      })
    return () => {
      c = true
    }
  }, [profileId, products.length])

  useEffect(() => {
    if (!profileId.trim()) {
      setHybridRec(null)
      return
    }
    let c = false
    const uid = encodeURIComponent(profileId.trim())
    api
      .get<HybridRecommendationResponse>(
        `/api/v1/recommendations/hybrid/${uid}`,
        {
          params: {
            top_k: 12,
            w_collaborative: 0.6,
            w_content: 0.4,
            max_pool: 200,
          },
        },
      )
      .then((r) => {
        if (!c) setHybridRec(r.data)
      })
      .catch(() => {
        if (!c) setHybridRec(null)
      })
    return () => {
      c = true
    }
  }, [profileId, products.length])

  useEffect(() => {
    if (!coldStartRec?.items.length) return
    trackImpressionBatch(
      'cold_start',
      coldStartRec.items.map((it) => it.product_id),
    )
  }, [coldStartRec, trackImpressionBatch])

  useEffect(() => {
    if (!hybridRec?.items.length) return
    trackImpressionBatch(
      'hybrid',
      hybridRec.items.map((it) => it.product_id),
    )
  }, [hybridRec, trackImpressionBatch])

  useEffect(() => {
    if (!cfRec?.items.length) return
    trackImpressionBatch(
      'collaborative',
      cfRec.items.map((it) => it.product_id),
    )
  }, [cfRec, trackImpressionBatch])

  useEffect(() => {
    if (!contentRec?.items.length || !heroId) return
    trackImpressionBatch(
      'content',
      contentRec.items.map((it) => it.product_id),
    )
  }, [contentRec, heroId, trackImpressionBatch])

  const loadMetrics = useCallback(() => {
    api
      .get<MetricsSummaryResponse>('/api/v1/metrics/summary', {
        params: { days: 7 },
      })
      .then((r) => setMetrics(r.data))
      .catch(() => setMetrics(null))
  }, [])

  useEffect(() => {
    loadMetrics()
  }, [loadMetrics])

  const runPrecisionEval = useCallback(async () => {
    setPAtKLoading(true)
    setPAtK(null)
    try {
      const res = await api.get<PrecisionAtKReport>(
        '/api/v1/evaluate/precision-at-k',
        { params: { k: 10, max_users: 50 } },
      )
      setPAtK(res.data)
    } catch (e) {
      setPAtK({
        k: 10,
        users_evaluated: 0,
        mean_precision_at_k: 0,
        detail: e instanceof Error ? e.message : 'eval failed',
      })
    } finally {
      setPAtKLoading(false)
    }
  }, [])

  const runPrecompute = useCallback(async () => {
    setPrecomputeBusy(true)
    try {
      await api.post('/api/v1/jobs/precompute')
      loadMetrics()
    } finally {
      setPrecomputeBusy(false)
    }
  }, [loadMetrics])

  const heroProduct = heroId ? byId.get(heroId) : undefined

  return (
    <div className="min-h-screen bg-[var(--es-surface-0)] text-[var(--es-text)]">
      <header className="sticky top-0 z-40 border-b border-[var(--es-border)] bg-[var(--es-elevated)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-4 px-4 py-4 md:px-8">
          <div className="flex items-center gap-3">
            <div
              className="es-display text-xl font-bold tracking-tight text-white"
              style={{ textShadow: '0 0 24px var(--es-glow)' }}
            >
              Echo<span className="text-[var(--es-accent)]">Suggest</span>
            </div>
            <span className="rounded-full border border-[var(--es-border)] bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
              Phase 10
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {user ? (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--es-border)] bg-black/30 px-3 py-2 text-xs text-zinc-300">
                <span className="max-w-[140px] truncate" title={user.email}>
                  {user.display_name ?? user.email}
                </span>
                <button
                  type="button"
                  disabled={!user.id}
                  onClick={() => setProfileId(user.id)}
                  className="rounded border border-zinc-600 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-200 hover:bg-white/10 disabled:opacity-40"
                >
                  Use for rails
                </button>
                <button
                  type="button"
                  onClick={() => logout()}
                  className="rounded border border-red-900/60 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-red-300 hover:bg-red-950/40"
                >
                  Log out
                </button>
              </div>
            ) : (
              <div className="flex max-w-md flex-col gap-2 rounded-lg border border-[var(--es-border)] bg-black/30 px-3 py-2 sm:flex-row sm:flex-wrap sm:items-end">
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="Email"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  className="min-w-[140px] flex-1 rounded-md border border-[var(--es-border)] bg-black/40 px-2 py-1.5 text-xs text-white outline-none focus:border-[var(--es-accent)]"
                />
                <input
                  type="password"
                  autoComplete={
                    authMode === 'register'
                      ? 'new-password'
                      : 'current-password'
                  }
                  placeholder="Password (8+)"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  className="min-w-[120px] flex-1 rounded-md border border-[var(--es-border)] bg-black/40 px-2 py-1.5 text-xs text-white outline-none focus:border-[var(--es-accent)]"
                />
                {authMode === 'register' ? (
                  <input
                    type="text"
                    autoComplete="name"
                    placeholder="Display name"
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    className="min-w-[120px] flex-1 rounded-md border border-[var(--es-border)] bg-black/40 px-2 py-1.5 text-xs text-white outline-none focus:border-[var(--es-accent)]"
                  />
                ) : null}
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    disabled={authBusy}
                    onClick={() => {
                      void login(authEmail, authPassword).catch(() => {})
                    }}
                    className="rounded-md bg-[var(--es-accent)] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-white hover:brightness-110 disabled:opacity-50"
                  >
                    Log in
                  </button>
                  <button
                    type="button"
                    disabled={authBusy}
                    onClick={() => {
                      void register(
                        authEmail,
                        authPassword,
                        authName || undefined,
                      ).catch(() => {})
                    }}
                    className="rounded-md border border-zinc-600 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-zinc-200 hover:bg-white/10 disabled:opacity-50"
                  >
                    Register
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setAuthMode((m) => (m === 'login' ? 'register' : 'login'))
                    }
                    className="px-2 py-1.5 text-[10px] text-zinc-500 underline"
                  >
                    {authMode === 'login' ? 'Need account?' : 'Have account?'}
                  </button>
                </div>
                {authError ? (
                  <p className="w-full text-[10px] text-red-400">{authError}</p>
                ) : null}
              </div>
            )}
            <label className="flex items-center gap-2 text-xs text-zinc-400">
              Profile
              <input
                value={profileId}
                onChange={(e) => setProfileId(e.target.value)}
                className="w-40 rounded-md border border-[var(--es-border)] bg-black/40 px-2 py-1.5 text-sm text-white outline-none focus:border-[var(--es-accent)]"
              />
            </label>
            <button
              type="button"
              onClick={() => void loadProducts()}
              className="rounded-md border border-[var(--es-border)] bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-white/10"
            >
              Refresh catalog
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-8 md:px-8">
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative mb-10 overflow-hidden rounded-[var(--es-radius-xl)] border border-[var(--es-border)] bg-[var(--es-surface-1)] shadow-[var(--es-shadow-card)]"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-red-950/80 via-zinc-950/40 to-transparent" />
          <div className="relative grid gap-6 p-6 md:grid-cols-[1.2fr_1fr] md:p-10">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-400">
                Featured for you
              </p>
              <h1 className="es-display mt-2 text-3xl font-bold tracking-tight text-white md:text-4xl">
                {heroProduct?.title ?? 'Pick a title to explore'}
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-zinc-400">
                {heroProduct?.description?.slice(0, 220) ??
                  'Hybrid recommendations blend collaborative signals with TF-IDF content similarity. Cold-start rails surface trending momentum when data is sparse.'}
                {heroProduct?.description && heroProduct.description.length > 220
                  ? '…'
                  : ''}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() =>
                    heroId &&
                    void trackEvent({
                      user_id: profileId,
                      product_id: heroId,
                      event_type: 'click',
                      source: 'catalog',
                    })
                  }
                  className="rounded-md bg-[var(--es-accent)] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-red-900/40 hover:brightness-110"
                >
                  Play preview
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const next = products[Math.floor(Math.random() * products.length)]
                    if (next) setHeroId(next.id)
                  }}
                  className="rounded-md border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-medium text-white hover:bg-white/10"
                >
                  Shuffle hero
                </button>
              </div>
            </div>
            <div className="flex flex-col justify-end gap-2 rounded-[var(--es-radius-lg)] border border-[var(--es-border)] bg-black/30 p-4 text-xs text-zinc-500">
              <p>
                <span className="text-zinc-400">Hybrid strategy:</span>{' '}
                <span className="font-mono text-amber-200/90">
                  {hybridRec?.strategy ?? '—'}
                </span>
              </p>
              {metrics && (
                <p>
                  7d CTR (all sources):{' '}
                  <span className="font-mono text-emerald-300">
                    {(metrics.overall_ctr * 100).toFixed(2)}%
                  </span>{' '}
                  · Redis: {metrics.redis_connected ? 'up' : 'down'}
                </p>
              )}
            </div>
          </div>
        </motion.section>

        {productsError && (
          <p className="mb-6 text-sm text-red-400">{productsError}</p>
        )}

        <div className="mb-8 flex flex-wrap items-end gap-2 rounded-[var(--es-radius-lg)] border border-[var(--es-border)] bg-[var(--es-surface-1)] p-4">
          <div className="min-w-[160px] flex-1">
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Search catalog
            </label>
            <input
              value={catalogQ}
              onChange={(e) => setCatalogQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void loadProducts()
              }}
              placeholder="Title or description…"
              className="w-full rounded-md border border-[var(--es-border)] bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[var(--es-accent)]"
            />
          </div>
          <div className="w-40">
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Category
            </label>
            <input
              value={catalogCategory}
              onChange={(e) => setCatalogCategory(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void loadProducts()
              }}
              placeholder="Exact match"
              className="w-full rounded-md border border-[var(--es-border)] bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[var(--es-accent)]"
            />
          </div>
          <button
            type="button"
            onClick={() => void loadProducts()}
            className="rounded-md bg-[var(--es-accent)] px-4 py-2 text-xs font-bold uppercase tracking-wide text-white hover:brightness-110"
          >
            Search
          </button>
          <button
            type="button"
            onClick={() => {
              setCatalogQ('')
              setCatalogCategory('')
              void (async () => {
                setProductsError(null)
                try {
                  const res = await api.get<Product[]>('/api/v1/products', {
                    params: { limit: '80' },
                  })
                  setProducts(res.data)
                  setHeroId((prev) => {
                    if (prev && res.data.some((p) => p.id === prev)) return prev
                    return res.data[0]?.id ?? null
                  })
                } catch (e) {
                  setProductsError(
                    e instanceof Error ? e.message : 'Failed to load products',
                  )
                }
              })()
            }}
            className="rounded-md border border-[var(--es-border)] px-4 py-2 text-xs font-medium text-zinc-300 hover:bg-white/5"
          >
            Clear
          </button>
        </div>

        {user && savedProducts.length > 0 ? (
          <ContentRail
            title="Your saved list"
            description="Titles you bookmarked while signed in (stored in MongoDB)."
          >
            {savedProducts.map((p) => (
              <PosterCard
                key={p.id}
                product={p}
                saved
                saveDisabled={saveBusy}
                onToggleSave={() => void toggleSave(p.id, true)}
                onSelect={() => setHeroId(p.id)}
              />
            ))}
          </ContentRail>
        ) : null}

        <ContentRail
          title="Trending now"
          description="Time-decayed interaction scores — segment-aware filters available via API."
        >
          {coldStartRec?.items.map((it) => (
            <PosterCard
              key={it.product_id}
              product={byId.get(it.product_id)}
              meta={`score ${it.score.toFixed(2)}`}
              saved={savedIds.has(it.product_id)}
              saveDisabled={saveBusy}
              onToggleSave={
                user
                  ? () =>
                      void toggleSave(it.product_id, savedIds.has(it.product_id))
                  : undefined
              }
              onSelect={() => {
                setHeroId(it.product_id)
                void trackEvent({
                  user_id: profileId,
                  product_id: it.product_id,
                  event_type: 'click',
                  source: 'cold_start',
                })
              }}
            />
          ))}
        </ContentRail>

        <ContentRail
          title="Because you viewed this"
          description="Content-based neighbors (TF-IDF + cosine) for the hero title."
        >
          {recLoading && (
            <p className="text-sm text-zinc-500">Loading similar titles…</p>
          )}
          {!recLoading &&
            contentRec?.items.map((it) => (
              <PosterCard
                key={it.product_id}
                product={byId.get(it.product_id)}
                meta={`match ${(it.score * 100).toFixed(0)}%`}
                saved={savedIds.has(it.product_id)}
                saveDisabled={saveBusy}
                onToggleSave={
                  user
                    ? () =>
                        void toggleSave(
                          it.product_id,
                          savedIds.has(it.product_id),
                        )
                    : undefined
                }
                onSelect={() => {
                  setHeroId(it.product_id)
                  void trackEvent({
                    user_id: profileId,
                    product_id: it.product_id,
                    event_type: 'click',
                    source: 'content',
                  })
                }}
              />
            ))}
        </ContentRail>

        <ContentRail
          title="Top picks for you"
          description="Hybrid blend of collaborative estimates and content affinity."
        >
          {hybridRec?.items.map((it) => (
            <PosterCard
              key={it.product_id}
              product={byId.get(it.product_id)}
              meta={`h=${it.hybrid_score.toFixed(2)}`}
              saved={savedIds.has(it.product_id)}
              saveDisabled={saveBusy}
              onToggleSave={
                user
                  ? () =>
                      void toggleSave(it.product_id, savedIds.has(it.product_id))
                  : undefined
              }
              onSelect={() => {
                setHeroId(it.product_id)
                void trackEvent({
                  user_id: profileId,
                  product_id: it.product_id,
                  event_type: 'click',
                  source: 'hybrid',
                })
              }}
            />
          ))}
        </ContentRail>

        <ContentRail
          title="Collaborative (SVD)"
          description="Matrix factorization on your interaction-derived ratings."
        >
          {cfRec?.items.map((it) => (
            <PosterCard
              key={it.product_id}
              product={byId.get(it.product_id)}
              meta={`est ${it.estimated_rating.toFixed(2)}`}
              saved={savedIds.has(it.product_id)}
              saveDisabled={saveBusy}
              onToggleSave={
                user
                  ? () =>
                      void toggleSave(it.product_id, savedIds.has(it.product_id))
                  : undefined
              }
              onSelect={() => {
                setHeroId(it.product_id)
                void trackEvent({
                  user_id: profileId,
                  product_id: it.product_id,
                  event_type: 'click',
                  source: 'collaborative',
                })
              }}
            />
          ))}
        </ContentRail>

        <details className="rounded-[var(--es-radius-xl)] border border-[var(--es-border)] bg-[var(--es-surface-1)] p-4 md:p-6">
          <summary className="cursor-pointer es-display text-sm font-semibold text-zinc-300">
            Developer tools &amp; ops
          </summary>
          <div className="mt-4 grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Health
              </h3>
              <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-black/50 p-3 text-xs text-emerald-300">
                {JSON.stringify(health, null, 2)}
              </pre>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                MongoDB
              </h3>
              <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-black/50 p-3 text-xs text-emerald-300">
                {JSON.stringify(dbPing, null, 2)}
              </pre>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Metrics (7d)
              </h3>
              <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-black/50 p-3 text-xs text-sky-200">
                {JSON.stringify(metrics, null, 2)}
              </pre>
              <button
                type="button"
                onClick={() => loadMetrics()}
                className="mt-2 rounded-md bg-zinc-800 px-3 py-1.5 text-xs text-zinc-200"
              >
                Refresh metrics
              </button>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Precompute job
              </h3>
              <p className="mt-2 text-xs text-zinc-500">
                Warms collaborative cache and stores trending snapshots in Redis.
              </p>
              <button
                type="button"
                disabled={precomputeBusy}
                onClick={() => void runPrecompute()}
                className="mt-2 rounded-md bg-violet-900/70 px-3 py-1.5 text-xs text-violet-100 disabled:opacity-50"
              >
                {precomputeBusy ? 'Scheduling…' : 'POST /jobs/precompute'}
              </button>
            </div>
          </div>
          <div className="mt-6 border-t border-[var(--es-border)] pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Precision@K (holdout)
            </h3>
            <button
              type="button"
              disabled={pAtKLoading}
              onClick={() => void runPrecisionEval()}
              className="mt-2 rounded-md bg-zinc-800 px-3 py-1.5 text-xs text-zinc-200 disabled:opacity-50"
            >
              {pAtKLoading ? 'Running…' : 'Run collaborative P@K'}
            </button>
            {pAtK && (
              <pre className="mt-3 max-h-48 overflow-auto rounded-lg bg-black/50 p-3 text-xs text-violet-200">
                {JSON.stringify(pAtK, null, 2)}
              </pre>
            )}
          </div>
        </details>
      </main>

      {loading && (
        <p className="fixed bottom-4 left-4 text-xs text-zinc-500">Connecting…</p>
      )}
      {error && (
        <p className="fixed bottom-4 left-4 text-xs text-red-400">{error}</p>
      )}
    </div>
  )
}
