import { create } from 'zustand'

import { api } from '../lib/api'

type Json = Record<string, unknown>

type StatusState = {
  health: Json | null
  dbPing: Json | null
  loading: boolean
  error: string | null
  fetchAll: () => Promise<void>
}

export const useStatusStore = create<StatusState>((set) => ({
  health: null,
  dbPing: null,
  loading: false,
  error: null,
  fetchAll: async () => {
    set({ loading: true, error: null })
    try {
      const [healthRes, dbRes] = await Promise.all([
        api.get<Json>('/api/v1/health'),
        api.get<Json>('/api/v1/db/ping'),
      ])
      set({
        health: healthRes.data,
        dbPing: dbRes.data,
        loading: false,
      })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to reach API'
      set({ error: message, loading: false })
    }
  },
}))
