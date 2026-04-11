import type { ReactNode } from 'react'

type Props = {
  title?: string
  eyebrow?: string
  description?: string
  accent?: 'red' | 'amber' | 'sky' | 'violet' | 'neutral'
  actions?: ReactNode
  children: ReactNode
}

const ACCENT_STYLES = {
  red: 'from-red-500/16 via-red-400/6 to-white/0',
  amber: 'from-amber-400/16 via-amber-300/6 to-white/0',
  sky: 'from-sky-400/16 via-sky-300/6 to-white/0',
  violet: 'from-violet-400/16 via-violet-300/6 to-white/0',
  neutral: 'from-white/10 via-white/4 to-white/0',
} as const

export function TemplatePanel({
  title,
  eyebrow,
  description,
  accent = 'neutral',
  actions,
  children,
}: Props) {
  return (
    <section className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[rgba(13,16,24,0.88)] shadow-[0_24px_70px_rgba(0,0,0,0.32)]">
      <div
        className={`pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,var(--tw-gradient-stops))] ${ACCENT_STYLES[accent]}`}
      />
      <div className="relative p-5 md:p-6">
        {(title || eyebrow || description || actions) && (
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div className="max-w-2xl">
              {eyebrow ? (
                <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-zinc-500">
                  {eyebrow}
                </p>
              ) : null}
              {title ? (
                <h2 className="es-display mt-2 text-2xl font-semibold tracking-tight text-white md:text-3xl">
                  {title}
                </h2>
              ) : null}
              {description ? (
                <p className="mt-2 text-sm leading-7 text-zinc-400">{description}</p>
              ) : null}
            </div>
            {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
          </div>
        )}
        {children}
      </div>
    </section>
  )
}
