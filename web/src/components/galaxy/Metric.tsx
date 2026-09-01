/**
 * @file Metric component.
 * @description A small, reusable stat tile used inside the galaxy detail panel
 * to summarise a celestial body's task breakdown (in-progress / completed /
 * overdue / breach). Defined here so the symbol `Metric` is always available
 * wherever it is imported — eliminating any "Metric is not defined" error.
 */

import type { FC } from 'react'

export type MetricTone = 'neutral' | 'info' | 'positive' | 'warn' | 'danger'

export interface MetricProps {
  label: string
  value: number | string
  tone?: MetricTone
  hint?: string
}

const TONE_CLASS: Record<MetricTone, string> = {
  neutral: 'text-slate-100',
  info: 'text-amber-400',
  positive: 'text-emerald-400',
  warn: 'text-amber-400',
  danger: 'text-red-400',
}

/**
 * @description Renders a single metric tile.
 */
export const Metric: FC<MetricProps> = ({ label, value, tone = 'neutral', hint }) => {
  return (
    <div className="rounded-lg bg-white/5 px-3 py-2 ring-1 ring-white/10">
      <div className={`text-lg font-semibold leading-none ${TONE_CLASS[tone]}`}>{value}</div>
      <div className="mt-1 text-[11px] leading-tight text-slate-400">{label}</div>
      {hint ? <div className="mt-0.5 text-[10px] leading-tight text-slate-500">{hint}</div> : null}
    </div>
  )
}

export default Metric
