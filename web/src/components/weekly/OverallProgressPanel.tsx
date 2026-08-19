/**
 * @file OverallProgressPanel component.
 * @description Displays overall life progress across all tasks and categories.
 */

import type { FC } from 'react'
import type { Task } from '../../types/task'
import {
  getOverallCategoryProgress,
  getOverallProgress,
} from '../../utils/taskUtils'

/**
 * @description Props for OverallProgressPanel.
 */
export interface OverallProgressPanelProps {
  tasks: Task[]
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
 * @description Overall life progress visualisation across all time.
 */
export const OverallProgressPanel: FC<OverallProgressPanelProps> = ({ tasks }) => {
  const overall = getOverallProgress(tasks)
  const overallResearch = getOverallCategoryProgress(tasks, 'research')
  const overallWork = getOverallCategoryProgress(tasks, 'work')
  const overallLife = getOverallCategoryProgress(tasks, 'life')

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white/90 p-3 shadow-sm">
      <div>
        <h3 className="text-xs font-semibold uppercase text-slate-500">
          Overall · life progress
        </h3>
        <div className="mt-2 space-y-2">
          <ProgressBar fraction={overall} label="All tasks overall" />
          <ProgressBar fraction={overallResearch} label="Research overall" />
          <ProgressBar fraction={overallWork} label="Work overall" />
          <ProgressBar fraction={overallLife} label="Life overall" />
        </div>
      </div>
    </section>
  )
}
