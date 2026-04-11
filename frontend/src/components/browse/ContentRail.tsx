import type { ReactNode } from 'react'

type Props = {
  title: string
  description?: string
  children: ReactNode
}

export function ContentRail({ title, description, children }: Props) {
  return (
    <section className="mb-[var(--es-space-8)]">
      <div className="mb-[var(--es-space-4)] flex flex-wrap items-end justify-between gap-3 px-1">
        <div>
          <h2 className="es-display text-lg font-semibold tracking-tight text-white md:text-xl">
            {title}
          </h2>
          {description && (
            <p className="mt-1 max-w-2xl text-sm text-[var(--es-text-muted)]">
              {description}
            </p>
          )}
        </div>
      </div>
      <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 scrollbar-thin md:mx-0 md:px-0">
        {children}
      </div>
    </section>
  )
}
