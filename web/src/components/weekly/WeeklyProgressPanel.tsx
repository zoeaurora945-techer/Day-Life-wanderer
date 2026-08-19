/**
 * @file WeeklyProgressPanel component.
 * @description Displays weekly progress bars for research/work/life for the selected week.
 */

import type { FC } from 'react'
import type { Category, Task } from '../../types/task'
import { getWeekRangeForDate, formatDateKey } from '../../utils/dateUtils'
import { getWeeklyCategoryStats } from '../../utils/taskUtils'

/**
 * @description Props for WeeklyProgressPanel.
 */
export interface WeeklyProgressPanelProps {
  tasks: Task[]
  now: Date
}

/**
 * @description Simple horizontal progress bar.
 */
const ProgressBar: FC<{ fraction: number | null; label: string }> = ({
  fraction,
  label,
}) => {
  const pct = fraction === null ? 0 : Math.round(fraction * 100)
  const display = fraction === null ? '—' : `${pct}%`
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="text-xs text-slate-600">{display}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-slate-100">
        <div
          className="h-2 rounded-full bg-slate-800 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

/**
 * @description Computes category weekly fraction based on current tasks.
 */
function getWeeklyFraction(
  tasks: Task[],
  weekStart: string,
  weekEnd: string,
  category: Category,
) {
  const stats = getWeeklyCategoryStats(tasks, weekStart, weekEnd, category)
  if (stats.created === 0) return null
  return stats.done / stats.created
}

/**
 * @description Weekly progress (this week) visualisation.
 */
export const WeeklyProgressPanel: FC<WeeklyProgressPanelProps> = ({ tasks, now }) => {
  const { start, end } = getWeekRangeForDate(now)
  const weekStartKey = formatDateKey(start)
  const weekEndKey = formatDateKey(end)

  const weekResearch = getWeeklyFraction(tasks, weekStartKey, weekEndKey, 'research')
  const weekWork = getWeeklyFraction(tasks, weekStartKey, weekEndKey, 'work')
  const weekLife = getWeeklyFraction(tasks, weekStartKey, weekEndKey, 'life')

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white/90 p-3 shadow-sm">
      <div>
        <h3 className="text-xs font-semibold uppercase text-slate-500">
          This week · completion
        </h3>
        <div className="mt-2 space-y-2">
          <ProgressBar fraction={weekResearch} label="Research this week" />
          <ProgressBar fraction={weekWork} label="Work this week" />
          <ProgressBar fraction={weekLife} label="Life this week" />
        </div>
      </div>
    </section>
  )
}
