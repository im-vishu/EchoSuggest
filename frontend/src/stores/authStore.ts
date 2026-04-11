import { create } from 'zustand'

import { TOKEN_KEY, api } from '../lib/api'
import type { TokenResponse, UserPublic } from '../types/auth'

interface AuthState {
  user: UserPublic | null
  token: string | null
  authError: string | null
  busy: boolean
  login: (email: string, password: string) => Promise<void>
  register: (
    email: string,
    password: string,
    displayName?: string,
  ) => Promise<void>
  logout: () => void
  fetchMe: () => Promise<void>
  hydrateToken: () => void
}

function applySession(token: string, user: UserPublic) {
  localStorage.setItem(TOKEN_KEY, token)
  return { token, user, authError: null as string | null }
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token:
    typeof localStorage !== 'undefined'
      ? localStorage.getItem(TOKEN_KEY)
      : null,
  authError: null,
  busy: false,

  hydrateToken: () => {
    set({ token: localStorage.getItem(TOKEN_KEY) })
  },

  login: async (email, password) => {
    set({ busy: true, authError: null })
    try {
      const res = await api.post<TokenResponse>('/api/v1/auth/login', {
        email,
        password,
      })
      set({ ...applySession(res.data.access_token, res.data.user), busy: false })
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'response' in e
          ? String(
              (e as { response?: { data?: { detail?: string } } }).response
                ?.data?.detail ?? 'Login failed',
            )
          : 'Login failed'
      set({ authError: msg, busy: false })
      throw e
    }
  },

  register: async (email, password, displayName) => {
    set({ busy: true, authError: null })
    try {
      const res = await api.post<TokenResponse>('/api/v1/auth/register', {
        email,
        password,
        display_name: displayName || null,
      })
      set({ ...applySession(res.data.access_token, res.data.user), busy: false })
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'response' in e
          ? String(
              (e as { response?: { data?: { detail?: string } } }).response
                ?.data?.detail ?? 'Registration failed',
            )
          : 'Registration failed'
      set({ authError: msg, busy: false })
      throw e
    }
  },

  logout: () => {
    localStorage.removeItem(TOKEN_KEY)
    set({ token: null, user: null, authError: null })
  },

  fetchMe: async () => {
    const t = localStorage.getItem(TOKEN_KEY)
    if (!t) {
      set({ user: null, token: null })
      return
    }
    try {
      const res = await api.get<UserPublic>('/api/v1/users/me')
      set({ user: res.data, token: t })
    } catch {
      localStorage.removeItem(TOKEN_KEY)
      set({ user: null, token: null })
    }
  },
}))
