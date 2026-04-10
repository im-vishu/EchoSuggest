import { motion } from 'framer-motion'
import { useCallback, useEffect, useState } from 'react'

import { api } from './lib/api'
import { useStatusStore } from './stores/statusStore'
import type {
  CollaborativeRecommendationResponse,
  ContentRecommendationResponse,
  HybridRecommendationResponse,
  PrecisionAtKReport,
  Product,
} from './types/product'

function App() {
  const { health, dbPing, loading, error, fetchAll } = useStatusStore()
  const [products, setProducts] = useState<Product[]>([])
  const [productsError, setProductsError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [contentRec, setContentRec] =
    useState<ContentRecommendationResponse | null>(null)
  const [recLoading, setRecLoading] = useState(false)
  const [recError, setRecError] = useState<string | null>(null)
  const [cfUserId, setCfUserId] = useState('demo-alice')
  const [cfRec, setCfRec] =
    useState<CollaborativeRecommendationResponse | null>(null)
  const [cfLoading, setCfLoading] = useState(false)
  const [cfError, setCfError] = useState<string | null>(null)
  const [hybridRec, setHybridRec] =
    useState<HybridRecommendationResponse | null>(null)
  const [hybridLoading, setHybridLoading] = useState(false)
  const [hybridError, setHybridError] = useState<string | null>(null)
  const [pAtK, setPAtK] = useState<PrecisionAtKReport | null>(null)
  const [pAtKLoading, setPAtKLoading] = useState(false)

  const loadProducts = useCallback(async () => {
    setProductsError(null)
    try {
      const res = await api.get<Product[]>('/api/v1/products', {
        params: { limit: 50 },
      })
      setProducts(res.data)
      setSelectedId((prev) =>
        prev ?? (res.data[0]?.id ?? null),
      )
    } catch (e) {
      setProductsError(e instanceof Error ? e.message : 'Failed to load products')
    }
  }, [])

  useEffect(() => {
    void fetchAll()
  }, [fetchAll])

  useEffect(() => {
    if (!loading && !error) {
      void loadProducts()
    }
  }, [loading, error, loadProducts])

  useEffect(() => {
    if (!selectedId) {
      setContentRec(null)
      return
    }
    let cancelled = false
    setRecLoading(true)
    setRecError(null)
    api
      .get<ContentRecommendationResponse>(
        `/api/v1/recommendations/content/${selectedId}`,
        { params: { top_k: 8 } },
      )
      .then((res) => {
        if (!cancelled) setContentRec(res.data)
      })
      .catch((e) => {
        if (!cancelled) {
          setRecError(e instanceof Error ? e.message : 'Recommendation failed')
        }
      })
      .finally(() => {
        if (!cancelled) setRecLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedId])

  useEffect(() => {
    if (!cfUserId.trim()) {
      setCfRec(null)
      return
    }
    let cancelled = false
    setCfLoading(true)
    setCfError(null)
    const uid = encodeURIComponent(cfUserId.trim())
    api
      .get<CollaborativeRecommendationResponse>(
        `/api/v1/recommendations/collaborative/${uid}`,
        { params: { top_k: 8 } },
      )
      .then((res) => {
        if (!cancelled) setCfRec(res.data)
      })
      .catch((e) => {
        if (!cancelled) {
          setCfError(e instanceof Error ? e.message : 'Collaborative failed')
        }
      })
      .finally(() => {
        if (!cancelled) setCfLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [cfUserId, products.length])

  useEffect(() => {
    if (!cfUserId.trim()) {
      setHybridRec(null)
      return
    }
    let cancelled = false
    setHybridLoading(true)
    setHybridError(null)
    const uid = encodeURIComponent(cfUserId.trim())
    api
      .get<HybridRecommendationResponse>(
        `/api/v1/recommendations/hybrid/${uid}`,
        {
          params: { top_k: 8, w_collaborative: 0.6, w_content: 0.4, max_pool: 200 },
        },
      )
      .then((res) => {
        if (!cancelled) setHybridRec(res.data)
      })
      .catch((e) => {
        if (!cancelled) {
          setHybridError(e instanceof Error ? e.message : 'Hybrid failed')
        }
      })
      .finally(() => {
        if (!cancelled) setHybridLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [cfUserId, products.length])

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

  const selectedProduct = products.find((p) => p.id === selectedId)

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-12">
        <motion.header
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="mb-10"
        >
          <p className="text-sm font-medium uppercase tracking-widest text-red-500">
            EchoSuggest
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white md:text-4xl">
            Phase 4 — Hybrid + evaluation + cache
          </h1>
          <p className="mt-3 text-zinc-400">
            Blended CF + content scores, Redis-cached hybrid responses, and
            collaborative Precision@K (holdout).
          </p>
        </motion.header>

        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05 }}
          className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-xl"
        >
          {loading && (
            <p className="text-zinc-400" role="status">
              Checking API…
            </p>
          )}
          {error && (
            <p className="text-red-400" role="alert">
              {error}
            </p>
          )}
          {!loading && !error && (
            <div className="space-y-4 text-left">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Health
                  </h2>
                  <pre className="mt-2 overflow-x-auto rounded-lg bg-black/40 p-3 text-xs text-emerald-300">
                    {JSON.stringify(health, null, 2)}
                  </pre>
                </div>
                <div>
                  <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    MongoDB
                  </h2>
                  <pre className="mt-2 overflow-x-auto rounded-lg bg-black/40 p-3 text-xs text-emerald-300">
                    {JSON.stringify(dbPing, null, 2)}
                  </pre>
                </div>
              </div>

              <div className="border-t border-zinc-800 pt-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-sm font-medium text-zinc-300">
                    Catalog ({products.length})
                  </h2>
                  <button
                    type="button"
                    onClick={() => void loadProducts()}
                    className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700"
                  >
                    Refresh products
                  </button>
                </div>
                {productsError && (
                  <p className="mt-2 text-sm text-red-400">{productsError}</p>
                )}
                {!products.length && !productsError && (
                  <p className="mt-3 text-sm text-zinc-500">
                    No products yet. POST to{' '}
                    <code className="text-zinc-400">/api/v1/products/bulk</code>{' '}
                    or run{' '}
                    <code className="text-zinc-400">
                      python scripts/seed_demo_products.py
                    </code>{' '}
                    with the API running.
                  </p>
                )}
                {!!products.length && (
                  <ul className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
                    {products.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(p.id)}
                          className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                            p.id === selectedId
                              ? 'border-red-500/60 bg-red-950/30 text-white'
                              : 'border-zinc-800 bg-zinc-950/40 text-zinc-300 hover:border-zinc-700'
                          }`}
                        >
                          <span className="font-medium">{p.title}</span>
                          <span className="mt-0.5 block text-xs text-zinc-500">
                            {p.category}
                            {p.tags.length ? ` · ${p.tags.slice(0, 3).join(', ')}` : ''}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {selectedProduct && (
                <div className="border-t border-zinc-800 pt-4">
                  <h2 className="text-sm font-medium text-zinc-300">
                    Similar (content-based)
                  </h2>
                  <p className="mt-1 text-xs text-zinc-500">
                    Selected: {selectedProduct.title}
                  </p>
                  {recLoading && (
                    <p className="mt-2 text-sm text-zinc-400">Scoring…</p>
                  )}
                  {recError && (
                    <p className="mt-2 text-sm text-red-400">{recError}</p>
                  )}
                  {!recLoading && contentRec && (
                    <ul className="mt-3 space-y-2">
                      {contentRec.items.length === 0 && (
                        <li className="text-sm text-zinc-500">
                          Add more products to see neighbors.
                        </li>
                      )}
                      {contentRec.items.map((item) => {
                        const p = products.find((x) => x.id === item.product_id)
                        return (
                          <li
                            key={item.product_id}
                            className="flex items-center justify-between rounded-lg border border-zinc-800 bg-black/30 px-3 py-2 text-sm"
                          >
                            <span className="text-zinc-200">
                              {p?.title ?? item.product_id}
                            </span>
                            <span className="font-mono text-xs text-emerald-400">
                              {(item.score * 100).toFixed(1)}%
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              )}

              <div className="border-t border-zinc-800 pt-4">
                <h2 className="text-sm font-medium text-zinc-300">
                  For you (collaborative)
                </h2>
                <p className="mt-1 text-xs text-zinc-500">
                  User id (try{' '}
                  <button
                    type="button"
                    className="text-red-400 underline-offset-2 hover:underline"
                    onClick={() => setCfUserId('demo-alice')}
                  >
                    demo-alice
                  </button>
                  ,{' '}
                  <button
                    type="button"
                    className="text-red-400 underline-offset-2 hover:underline"
                    onClick={() => setCfUserId('demo-bob')}
                  >
                    demo-bob
                  </button>
                  ) — run{' '}
                  <code className="text-zinc-400">
                    python scripts/seed_demo_interactions.py
                  </code>
                </p>
                <label className="mt-2 block text-xs text-zinc-500">
                  User ID
                  <input
                    value={cfUserId}
                    onChange={(e) => setCfUserId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-zinc-600"
                    autoComplete="off"
                  />
                </label>
                {cfLoading && (
                  <p className="mt-2 text-sm text-zinc-400">Training / scoring…</p>
                )}
                {cfError && (
                  <p className="mt-2 text-sm text-red-400">{cfError}</p>
                )}
                {!cfLoading && cfRec && (
                  <ul className="mt-3 space-y-2">
                    {cfRec.items.length === 0 && (
                      <li className="text-sm text-zinc-500">
                        Need ≥5 interactions, ≥2 users, ≥2 items. Seed
                        interactions to train the SVD model.
                      </li>
                    )}
                    {cfRec.items.map((item) => {
                      const p = products.find((x) => x.id === item.product_id)
                      return (
                        <li
                          key={item.product_id}
                          className="flex items-center justify-between rounded-lg border border-zinc-800 bg-black/30 px-3 py-2 text-sm"
                        >
                          <span className="text-zinc-200">
                            {p?.title ?? item.product_id}
                          </span>
                          <span className="font-mono text-xs text-sky-400">
                            {item.estimated_rating.toFixed(2)} est.
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>

              <div className="border-t border-zinc-800 pt-4">
                <h2 className="text-sm font-medium text-zinc-300">
                  Hybrid (CF + content)
                </h2>
                <p className="mt-1 text-xs text-zinc-500">
                  Weights 0.6 / 0.4 (API query params). Cached in Redis when
                  connected.
                </p>
                {hybridLoading && (
                  <p className="mt-2 text-sm text-zinc-400">Blending…</p>
                )}
                {hybridError && (
                  <p className="mt-2 text-sm text-red-400">{hybridError}</p>
                )}
                {!hybridLoading && hybridRec && (
                  <>
                    <p className="mt-2 text-xs text-zinc-500">
                      Normalized weights: CF{' '}
                      {hybridRec.weight_collaborative.toFixed(2)}, content{' '}
                      {hybridRec.weight_content.toFixed(2)}
                    </p>
                    <ul className="mt-3 space-y-2">
                      {hybridRec.items.length === 0 && (
                        <li className="text-sm text-zinc-500">
                          No hybrid candidates (add catalog + interactions).
                        </li>
                      )}
                      {hybridRec.items.map((item) => {
                        const p = products.find((x) => x.id === item.product_id)
                        return (
                          <li
                            key={item.product_id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-black/30 px-3 py-2 text-sm"
                          >
                            <span className="text-zinc-200">
                              {p?.title ?? item.product_id}
                            </span>
                            <span className="font-mono text-xs text-amber-300">
                              h={item.hybrid_score.toFixed(3)} · c=
                              {item.content_similarity.toFixed(2)} · cf*=
                              {item.collaborative_norm.toFixed(2)}
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  </>
                )}
              </div>

              <div className="border-t border-zinc-800 pt-4">
                <h2 className="text-sm font-medium text-zinc-300">
                  Offline Precision@K (collaborative holdout)
                </h2>
                <p className="mt-1 text-xs text-zinc-500">
                  Last interaction per user held out; trains SVD on the rest.
                  Heavy on large logs.
                </p>
                <button
                  type="button"
                  onClick={() => void runPrecisionEval()}
                  disabled={pAtKLoading}
                  className="mt-2 rounded-lg bg-violet-900/60 px-3 py-1.5 text-xs font-medium text-violet-100 hover:bg-violet-800/60 disabled:opacity-50"
                >
                  {pAtKLoading ? 'Running…' : 'Run P@K (k=10, 50 users)'}
                </button>
                {pAtK && (
                  <pre className="mt-3 overflow-x-auto rounded-lg bg-black/40 p-3 text-left text-xs text-violet-200">
                    {JSON.stringify(pAtK, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          )}
        </motion.section>

        <p className="mt-8 text-center text-xs text-zinc-600">
          API base:{' '}
          {import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'}
        </p>
      </div>
    </div>
  )
}

export default App
