import { motion } from 'framer-motion'
import { startTransition, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import { TemplateStat } from '../template/TemplateStat'
import type { UserPublic } from '../../types/auth'

export type AppPage = 'discover' | 'saved' | 'insights'

type Props = {
  page: AppPage
  onNavigate: (page: AppPage) => void
  user: UserPublic | null
  authBusy: boolean
  authError: string | null
  onLogin: (email: string, password: string) => Promise<void>
  onRegister: (
    email: string,
    password: string,
    displayName?: string,
  ) => Promise<void>
  onLogout: () => void
  profileId: string
  onProfileChange: (value: string) => void
  onUseAccountProfile: () => void
  onRefreshCatalog: () => Promise<void>
  catalogCount: number
  savedCount: number
  redisConnected: boolean | null
  children: ReactNode
}

const PAGE_COPY: Record<AppPage, { label: string; eyebrow: string; body: string }> = {
  discover: {
    label: 'Discover',
    eyebrow: 'Recommendation Studio',
    body: 'Browse the live catalog, blend collaborative and content rails, and keep a single hero title in focus.',
  },
  saved: {
    label: 'Saved',
    eyebrow: 'Your Watchlist',
    body: 'See what signed-in users have bookmarked, jump back into a title, and keep the collection tidy.',
  },
  insights: {
    label: 'Insights',
    eyebrow: 'System Pulse',
    body: 'Check operational health, precompute status, analytics snapshots, and offline evaluation from one place.',
  },
}

const NAV_ITEMS: AppPage[] = ['discover', 'saved', 'insights']

export function AppShell({
  page,
  onNavigate,
  user,
  authBusy,
  authError,
  onLogin,
  onRegister,
  onLogout,
  profileId,
  onProfileChange,
  onUseAccountProfile,
  onRefreshCatalog,
  catalogCount,
  savedCount,
  redisConnected,
  children,
}: Props) {
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authName, setAuthName] = useState('')

  const pageCopy = useMemo(() => PAGE_COPY[page], [page])
  const cacheValue =
    redisConnected === null ? 'unknown' : redisConnected ? 'online' : 'offline'

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(248,113,113,0.18),_transparent_28%),linear-gradient(180deg,_#06070b_0%,_#0a0d14_55%,_#07070a_100%)] text-[var(--es-text)]">
      <header className="sticky top-0 z-40 border-b border-white/8 bg-[rgba(7,10,16,0.84)] backdrop-blur-2xl">
        <div className="mx-auto max-w-[1600px] px-4 py-4 md:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
                <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-red-300/80">
                  EchoSuggest
                </p>
                <p className="es-display text-lg font-bold tracking-tight text-white">
                  Signal-first discovery
                </p>
              </div>
              <div className="hidden rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-zinc-400 md:block">
                {catalogCount} catalog titles / {savedCount} saved
              </div>
            </div>

            <nav className="flex flex-wrap items-center gap-2">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => {
                    startTransition(() => onNavigate(item))
                  }}
                  className={`rounded-full px-4 py-2 text-sm transition ${
                    page === item
                      ? 'bg-white text-zinc-950 shadow-[0_8px_24px_rgba(255,255,255,0.12)]'
                      : 'border border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10'
                  }`}
                >
                  {PAGE_COPY[item].label}
                </button>
              ))}
            </nav>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <motion.section
              key={page}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.35)]"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-red-300/80">
                {pageCopy.eyebrow}
              </p>
              <div className="mt-3 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="max-w-2xl">
                  <h1 className="es-display text-3xl font-bold tracking-tight text-white md:text-4xl">
                    {pageCopy.label}
                  </h1>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-300">
                    {pageCopy.body}
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <TemplateStat
                    label="Active profile"
                    value={profileId || 'demo-alice'}
                    detail="Used for hybrid, collaborative, and analytics events."
                    tone="neutral"
                  />
                  <TemplateStat
                    label="Cache status"
                    value={cacheValue}
                    detail="Redis-backed recommendation caching and precompute snapshots."
                    tone={redisConnected ? 'sky' : 'amber'}
                  />
                </div>
              </div>
            </motion.section>

            <section className="rounded-[30px] border border-white/10 bg-[rgba(15,17,24,0.82)] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.32)]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-zinc-500">
                    Session
                  </p>
                  <p className="mt-1 text-sm text-zinc-300">
                    {user
                      ? user.display_name ?? user.email
                      : 'Sign in to save titles and use account-based recommendations.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void onRefreshCatalog()}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-200 hover:bg-white/10"
                >
                  Refresh catalog
                </button>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <TemplateStat
                  label="Catalog"
                  value={catalogCount.toString()}
                  detail="Searchable titles"
                  tone="red"
                />
                <TemplateStat
                  label="Saved"
                  value={savedCount.toString()}
                  detail="Bookmarked items"
                  tone="violet"
                />
                <TemplateStat
                  label="Mode"
                  value={pageCopy.label}
                  detail="Current workspace"
                  tone="neutral"
                />
              </div>

              {user ? (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={onUseAccountProfile}
                    className="rounded-full bg-[var(--es-accent)] px-4 py-2 text-xs font-semibold text-white hover:brightness-110"
                  >
                    Use account id
                  </button>
                  <button
                    type="button"
                    onClick={onLogout}
                    className="rounded-full border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs text-red-200 hover:bg-red-500/15"
                  >
                    Log out
                  </button>
                </div>
              ) : (
                <div className="mt-4 grid gap-2">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input
                      type="email"
                      autoComplete="email"
                      placeholder="Email"
                      value={authEmail}
                      onChange={(event) => setAuthEmail(event.target.value)}
                      className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-red-300/60"
                    />
                    <input
                      type="password"
                      autoComplete={authMode === 'register' ? 'new-password' : 'current-password'}
                      placeholder="Password (8+)"
                      value={authPassword}
                      onChange={(event) => setAuthPassword(event.target.value)}
                      className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-red-300/60"
                    />
                  </div>
                  {authMode === 'register' ? (
                    <input
                      type="text"
                      autoComplete="name"
                      placeholder="Display name"
                      value={authName}
                      onChange={(event) => setAuthName(event.target.value)}
                      className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-red-300/60"
                    />
                  ) : null}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={authBusy}
                      onClick={() => {
                        void onLogin(authEmail, authPassword).catch(() => {})
                      }}
                      className="rounded-full bg-[var(--es-accent)] px-4 py-2 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-60"
                    >
                      Log in
                    </button>
                    <button
                      type="button"
                      disabled={authBusy}
                      onClick={() => {
                        void onRegister(authEmail, authPassword, authName || undefined).catch(
                          () => {},
                        )
                      }}
                      className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-zinc-200 hover:bg-white/10 disabled:opacity-60"
                    >
                      Register
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setAuthMode((mode) => (mode === 'login' ? 'register' : 'login'))
                      }
                      className="text-xs text-zinc-500 underline underline-offset-4"
                    >
                      {authMode === 'login' ? 'Need an account?' : 'Already registered?'}
                    </button>
                  </div>
                  {authError ? <p className="text-xs text-red-300">{authError}</p> : null}
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
                <label className="text-xs uppercase tracking-[0.25em] text-zinc-500">
                  Active profile
                </label>
                <input
                  value={profileId}
                  onChange={(event) => onProfileChange(event.target.value)}
                  className="min-w-[180px] flex-1 rounded-full border border-white/10 bg-black/30 px-4 py-2 text-sm text-white outline-none focus:border-red-300/60"
                />
              </div>
            </section>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-8 md:px-8">{children}</main>
    </div>
  )
}
