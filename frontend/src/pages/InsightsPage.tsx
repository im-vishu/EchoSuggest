import { useState } from 'react'

import { TemplatePanel } from '../components/template/TemplatePanel'
import { TemplateStat } from '../components/template/TemplateStat'
import type { MetricsSummaryResponse } from '../types/analytics'
import type { JobStatusResponse } from '../types/jobs'
import type { PrecisionAtKReport } from '../types/product'

type Props = {
  health: Record<string, unknown> | null
  dbPing: Record<string, unknown> | null
  loading: boolean
  error: string | null
  metrics: MetricsSummaryResponse | null
  jobStatus: JobStatusResponse | null
  pAtK: PrecisionAtKReport | null
  pAtKLoading: boolean
  precomputeBusy: boolean
  onRefreshMetrics: () => Promise<void>
  onRunPrecompute: (adminApiKey?: string) => Promise<void>
  onRunPrecisionEval: () => Promise<void>
}

export function InsightsPage({
  health,
  dbPing,
  loading,
  error,
  metrics,
  jobStatus,
  pAtK,
  pAtKLoading,
  precomputeBusy,
  onRefreshMetrics,
  onRunPrecompute,
  onRunPrecisionEval,
}: Props) {
  const [adminApiKey, setAdminApiKey] = useState('')

  return (
    <div className="space-y-8">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <TemplateStat
          label="Overall CTR"
          value={metrics ? `${(metrics.overall_ctr * 100).toFixed(2)}%` : '--'}
          detail="Seven-day click-through rate"
          tone="red"
        />
        <TemplateStat
          label="Impressions"
          value={metrics ? metrics.total_impressions.toString() : '--'}
          detail="Tracked recommendation views"
          tone="sky"
        />
        <TemplateStat
          label="Clicks"
          value={metrics ? metrics.total_clicks.toString() : '--'}
          detail="Engagement events"
          tone="violet"
        />
        <TemplateStat
          label="Last precompute"
          value={
            jobStatus?.last_precompute_at
              ? new Date(jobStatus.last_precompute_at).toLocaleString()
              : 'Never'
          }
          detail="Redis snapshot freshness"
          tone="amber"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <TemplatePanel
          title="Metrics snapshot"
          eyebrow="Observability Template"
          description="Pulls from the 7-day analytics summary and the Redis-backed precompute job status."
          accent="sky"
          actions={
            <button
              type="button"
              onClick={() => void onRefreshMetrics()}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-zinc-200 hover:bg-white/10"
            >
              Refresh
            </button>
          }
        >
          <div className="grid gap-4 md:grid-cols-2">
            <pre className="max-h-56 overflow-auto rounded-[24px] border border-white/10 bg-black/35 p-4 text-xs text-emerald-200">
              {JSON.stringify(metrics, null, 2)}
            </pre>
            <pre className="max-h-56 overflow-auto rounded-[24px] border border-white/10 bg-black/35 p-4 text-xs text-sky-200">
              {JSON.stringify(jobStatus, null, 2)}
            </pre>
          </div>
        </TemplatePanel>

        <TemplatePanel
          title="Precompute controls"
          eyebrow="Ops Action"
          description="Trigger the hybrid warm-up job manually. Leave the API key blank if the backend is running without admin protection."
          accent="amber"
        >
          <input
            type="password"
            placeholder="Optional X-API-Key"
            value={adminApiKey}
            onChange={(event) => setAdminApiKey(event.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-red-300/60"
          />
          <button
            type="button"
            disabled={precomputeBusy}
            onClick={() => void onRunPrecompute(adminApiKey)}
            className="mt-4 rounded-full bg-[var(--es-accent)] px-5 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-white disabled:opacity-60"
          >
            {precomputeBusy ? 'Scheduling...' : 'Run precompute'}
          </button>
        </TemplatePanel>
      </section>

      <TemplatePanel
        title="Offline evaluation"
        eyebrow="Model Quality"
        description="Runs collaborative precision@K against the holdout evaluator already exposed by the backend."
        accent="violet"
        actions={
          <button
            type="button"
            disabled={pAtKLoading}
            onClick={() => void onRunPrecisionEval()}
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-zinc-200 hover:bg-white/10 disabled:opacity-60"
          >
            {pAtKLoading ? 'Running...' : 'Run precision@K'}
          </button>
        }
      >
        <pre className="mt-4 max-h-56 overflow-auto rounded-[24px] border border-white/10 bg-black/35 p-4 text-xs text-violet-200">
          {JSON.stringify(pAtK, null, 2)}
        </pre>
      </TemplatePanel>

      <section className="grid gap-6 xl:grid-cols-2">
        <TemplatePanel
          title="Health"
          eyebrow="API Status"
          description="API and MongoDB checks from the shared status store."
          accent="neutral"
        >
          <pre className="mt-4 max-h-56 overflow-auto rounded-[24px] border border-white/10 bg-black/35 p-4 text-xs text-emerald-200">
            {JSON.stringify({ loading, error, health }, null, 2)}
          </pre>
        </TemplatePanel>

        <TemplatePanel
          title="Database"
          eyebrow="Storage Status"
          description="Raw ping response plus the latest known Redis precompute keys."
          accent="sky"
        >
          <pre className="mt-4 max-h-56 overflow-auto rounded-[24px] border border-white/10 bg-black/35 p-4 text-xs text-sky-200">
            {JSON.stringify(
              { dbPing, redisKeys: jobStatus?.redis_precompute_keys ?? [] },
              null,
              2,
            )}
          </pre>
        </TemplatePanel>
      </section>
    </div>
  )
}
