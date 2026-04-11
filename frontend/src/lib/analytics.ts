import { api } from './api'
import type { AnalyticsTrackPayload } from '../types/analytics'

export async function trackEvent(payload: AnalyticsTrackPayload): Promise<void> {
  try {
    await api.post('/api/v1/analytics/track', payload)
  } catch {
    /* non-blocking analytics */
  }
}
