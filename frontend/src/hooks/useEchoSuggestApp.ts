import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { trackEvent } from '../lib/analytics'
import { api } from '../lib/api'
import { useAuthStore } from '../stores/authStore'
import { useStatusStore } from '../stores/statusStore'
import type { MetricsSummaryResponse } from '../types/analytics'
import type { JobStatusResponse } from '../types/jobs'
import type {
  ColdStartRecommendationResponse,
  CollaborativeRecommendationResponse,
  ContentRecommendationResponse,
  HybridRecommendationResponse,
  PrecisionAtKReport,
  Product,
} from '../types/product'
import type { SavedListResponse } from '../types/saved'

type RailSource = 'catalog' | 'cold_start' | 'content' | 'hybrid' | 'collaborative'

function toProductMap(...lists: Product[][]) {
  return new Map(lists.flat().map((product) => [product.id, product]))
}

export function useEchoSuggestApp() {
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
  const [catalogIndex, setCatalogIndex] = useState<Product[]>([])
  const [productsError, setProductsError] = useState<string | null>(null)
  const [heroId, setHeroId] = useState<string | null>(null)
  const [profileId, setProfileId] = useState('demo-alice')
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
  const [jobStatus, setJobStatus] = useState<JobStatusResponse | null>(null)
  const [pAtK, setPAtK] = useState<PrecisionAtKReport | null>(null)
  const [pAtKLoading, setPAtKLoading] = useState(false)
  const [precomputeBusy, setPrecomputeBusy] = useState(false)

  const impressionKeysRef = useRef<Set<string>>(new Set())

  const byId = useMemo(
    () => toProductMap(catalogIndex, products, savedProducts),
    [catalogIndex, products, savedProducts],
  )

  const loadCatalogIndex = useCallback(async () => {
    try {
      const res = await api.get<Product[]>('/api/v1/products', {
        params: { limit: '200' },
      })
      setCatalogIndex(res.data)
    } catch {
      setCatalogIndex([])
    }
  }, [])

  const loadProductsWith = useCallback(async (q: string, category: string) => {
    setProductsError(null)
    try {
      const params: Record<string, string> = { limit: '80' }
      const trimmedQ = q.trim()
      const trimmedCategory = category.trim()
      if (trimmedQ) params.q = trimmedQ
      if (trimmedCategory) params.category = trimmedCategory

      const res = await api.get<Product[]>('/api/v1/products', { params })
      setProducts(res.data)
      setHeroId((prev) => {
        if (prev && res.data.some((product) => product.id === prev)) {
          return prev
        }
        return res.data[0]?.id ?? null
      })
      if (!trimmedQ && !trimmedCategory) {
        setCatalogIndex(res.data)
      }
    } catch (e) {
      setProductsError(e instanceof Error ? e.message : 'Failed to load products')
    }
  }, [])

  const loadProducts = useCallback(
    async () => loadProductsWith(catalogQ, catalogCategory),
    [catalogCategory, catalogQ, loadProductsWith],
  )

  const clearCatalogFilters = useCallback(async () => {
    setCatalogQ('')
    setCatalogCategory('')
    await loadProductsWith('', '')
  }, [loadProductsWith])

  const refreshCatalog = useCallback(async () => {
    await Promise.all([loadCatalogIndex(), loadProductsWith(catalogQ, catalogCategory)])
  }, [catalogCategory, catalogQ, loadCatalogIndex, loadProductsWith])

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
      setSavedIds(new Set(res.data.items.map((item) => item.product_id)))
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
          await api.delete(`/api/v1/me/saved/${encodeURIComponent(productId)}`)
        } else {
          await api.post('/api/v1/me/saved', { product_id: productId })
        }
        await fetchSaved()
      } finally {
        setSaveBusy(false)
      }
    },
    [fetchSaved, user],
  )

  const trackImpressionBatch = useCallback(
    (source: Exclude<RailSource, 'catalog'>, productIds: string[]) => {
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

  const trackClick = useCallback(
    (productId: string, source: RailSource) => {
      void trackEvent({
        user_id: profileId,
        product_id: productId,
        event_type: 'click',
        source,
      })
    },
    [profileId],
  )

  const selectProduct = useCallback(
    (productId: string, source: RailSource) => {
      setHeroId(productId)
      trackClick(productId, source)
    },
    [trackClick],
  )

  const loadMetrics = useCallback(async () => {
    try {
      const res = await api.get<MetricsSummaryResponse>('/api/v1/metrics/summary', {
        params: { days: 7 },
      })
      setMetrics(res.data)
    } catch {
      setMetrics(null)
    }
  }, [])

  const loadJobStatus = useCallback(async () => {
    try {
      const res = await api.get<JobStatusResponse>('/api/v1/jobs/status')
      setJobStatus(res.data)
    } catch {
      setJobStatus(null)
    }
  }, [])

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

  const runPrecompute = useCallback(
    async (adminApiKey?: string) => {
      setPrecomputeBusy(true)
      try {
        const headers = adminApiKey?.trim()
          ? { 'X-API-Key': adminApiKey.trim() }
          : undefined
        await api.post('/api/v1/jobs/precompute', undefined, { headers })
        await Promise.all([loadMetrics(), loadJobStatus()])
      } finally {
        setPrecomputeBusy(false)
      }
    },
    [loadJobStatus, loadMetrics],
  )

  useEffect(() => {
    void fetchAll()
  }, [fetchAll])

  useEffect(() => {
    hydrateToken()
    void fetchMe()
  }, [fetchMe, hydrateToken])

  useEffect(() => {
    void fetchSaved()
  }, [fetchSaved])

  useEffect(() => {
    if (!loading && !error) {
      void refreshCatalog()
    }
  }, [error, loading, refreshCatalog])

  useEffect(() => {
    if (!catalogIndex.length) {
      setColdStartRec(null)
      return
    }
    api
      .get<ColdStartRecommendationResponse>('/api/v1/recommendations/cold-start', {
        params: { top_k: 12, mode: 'trending', window_days: 30 },
      })
      .then((res) => setColdStartRec(res.data))
      .catch(() => setColdStartRec(null))
  }, [catalogIndex.length])

  useEffect(() => {
    if (!heroId) {
      setContentRec(null)
      return
    }
    let cancelled = false
    setRecLoading(true)
    api
      .get<ContentRecommendationResponse>(`/api/v1/recommendations/content/${heroId}`, {
        params: { top_k: 12 },
      })
      .then((res) => {
        if (!cancelled) setContentRec(res.data)
      })
      .catch(() => {
        if (!cancelled) setContentRec(null)
      })
      .finally(() => {
        if (!cancelled) setRecLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [heroId])

  useEffect(() => {
    if (!profileId.trim() || !catalogIndex.length) {
      setCfRec(null)
      return
    }
    let cancelled = false
    const userId = encodeURIComponent(profileId.trim())
    api
      .get<CollaborativeRecommendationResponse>(
        `/api/v1/recommendations/collaborative/${userId}`,
        { params: { top_k: 12 } },
      )
      .then((res) => {
        if (!cancelled) setCfRec(res.data)
      })
      .catch(() => {
        if (!cancelled) setCfRec(null)
      })
    return () => {
      cancelled = true
    }
  }, [catalogIndex.length, profileId])

  useEffect(() => {
    if (!profileId.trim() || !catalogIndex.length) {
      setHybridRec(null)
      return
    }
    let cancelled = false
    const userId = encodeURIComponent(profileId.trim())
    api
      .get<HybridRecommendationResponse>(
        `/api/v1/recommendations/hybrid/${userId}`,
        {
          params: {
            top_k: 12,
            w_collaborative: 0.6,
            w_content: 0.4,
            max_pool: 200,
          },
        },
      )
      .then((res) => {
        if (!cancelled) setHybridRec(res.data)
      })
      .catch(() => {
        if (!cancelled) setHybridRec(null)
      })
    return () => {
      cancelled = true
    }
  }, [catalogIndex.length, profileId])

  useEffect(() => {
    if (!coldStartRec?.items.length) return
    trackImpressionBatch(
      'cold_start',
      coldStartRec.items.map((item) => item.product_id),
    )
  }, [coldStartRec, trackImpressionBatch])

  useEffect(() => {
    if (!hybridRec?.items.length) return
    trackImpressionBatch(
      'hybrid',
      hybridRec.items.map((item) => item.product_id),
    )
  }, [hybridRec, trackImpressionBatch])

  useEffect(() => {
    if (!cfRec?.items.length) return
    trackImpressionBatch(
      'collaborative',
      cfRec.items.map((item) => item.product_id),
    )
  }, [cfRec, trackImpressionBatch])

  useEffect(() => {
    if (!contentRec?.items.length) return
    trackImpressionBatch(
      'content',
      contentRec.items.map((item) => item.product_id),
    )
  }, [contentRec, trackImpressionBatch])

  useEffect(() => {
    void loadMetrics()
    void loadJobStatus()
  }, [loadJobStatus, loadMetrics])

  return {
    health,
    dbPing,
    loading,
    error,
    user,
    authError,
    authBusy,
    login,
    register,
    logout,
    products,
    catalogIndex,
    byId,
    productsError,
    heroId,
    setHeroId,
    profileId,
    setProfileId,
    catalogQ,
    setCatalogQ,
    catalogCategory,
    setCatalogCategory,
    loadProducts,
    clearCatalogFilters,
    refreshCatalog,
    savedIds,
    savedProducts,
    saveBusy,
    toggleSave,
    coldStartRec,
    hybridRec,
    cfRec,
    contentRec,
    recLoading,
    metrics,
    jobStatus,
    pAtK,
    pAtKLoading,
    precomputeBusy,
    loadMetrics,
    runPrecisionEval,
    runPrecompute,
    trackClick,
    selectProduct,
  }
}
