export type AnalyticsSource =
  | 'hybrid'
  | 'collaborative'
  | 'content'
  | 'cold_start'
  | 'catalog'

export type AnalyticsTrackPayload = {
  user_id: string
  product_id: string
  event_type: 'impression' | 'click'
  source: AnalyticsSource
}

export type MetricsSummaryResponse = {
  redis_connected: boolean
  analytics_window_days: number
  total_impressions: number
  total_clicks: number
  overall_ctr: number
}
