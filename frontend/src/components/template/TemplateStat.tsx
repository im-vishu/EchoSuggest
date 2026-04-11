type Props = {
  label: string
  value: string
  detail?: string
  tone?: 'red' | 'amber' | 'sky' | 'violet' | 'neutral'
}

const TONE_STYLES = {
  red: 'border-red-400/20 bg-red-500/10',
  amber: 'border-amber-400/20 bg-amber-500/10',
  sky: 'border-sky-400/20 bg-sky-500/10',
  violet: 'border-violet-400/20 bg-violet-500/10',
  neutral: 'border-white/10 bg-white/5',
} as const

export function TemplateStat({
  label,
  value,
  detail,
  tone = 'neutral',
}: Props) {
  return (
    <div className={`rounded-[24px] border p-4 ${TONE_STYLES[tone]}`}>
      <p className="text-[11px] uppercase tracking-[0.3em] text-zinc-500">{label}</p>
      <p className="mt-2 es-display text-3xl text-white">{value}</p>
      {detail ? <p className="mt-2 text-sm text-zinc-400">{detail}</p> : null}
    </div>
  )
}
