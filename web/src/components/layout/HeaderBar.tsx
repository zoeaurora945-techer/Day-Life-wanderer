/**
 * @file HeaderBar component.
 * @description Displays today's date, current week index with week-of-year index, and a year week-progress bar plus global "new task" trigger.
 */

import type { FC } from 'react'
import {
  formatDateKey,
  getWeekNumberOfYear,
  getWeekRangeForDate,
} from '../../utils/dateUtils'

/**
 * @description Props for HeaderBar.
 */
export interface HeaderBarProps {
  now: Date
  onCreateTask: () => void
}

/**
 * @description Formats a Date into MM/DD using local time (no year).
 * @param date - Date to format.
 * @returns A string in MM/DD format.
 */
function formatMonthDay(date: Date): string {
  const month = date.getMonth() + 1
  const day = date.getDate()
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`)
  return `${pad(month)}/${pad(day)}`
}

/**
 * @description Returns Chinese weekday label (周日~周六) for a given date.
 * @param date - Date to format.
 */
function getWeekdayLabel(date: Date): string {
  const labels = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  const index = date.getDay()
  return labels[index] ?? ''
}

/**
 * @description Top header showing current date, week index within the year, week range, and a year week-progress bar.
 */
export const HeaderBar: FC<HeaderBarProps> = ({ now, onCreateTask }) => {
  const { start, end } = getWeekRangeForDate(now)
  const { week, totalWeeks } = getWeekNumberOfYear(now)

  const todayLabel = formatDateKey(now)
  const weekdayLabel = getWeekdayLabel(now)
  const weekRangeLabel = `${formatMonthDay(start)}-${formatMonthDay(end)}`

  const progressFraction = totalWeeks === 0 ? 0 : week / totalWeeks
  const clampedFraction = Math.max(0, Math.min(1, progressFraction))
  const progressPct = Math.round(clampedFraction * 100)

  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur">
      <div className="flex flex-col">
        <span className="text-xs font-medium text-slate-500">
          {weekdayLabel}
        </span>
        <span className="text-base font-semibold text-slate-900">
          {todayLabel}
        </span>

        {/* Week index from Jan 1 + week date range without year */}
        <span className="mt-1 text-xs text-slate-600">
          Week {week} · {weekRangeLabel}
        </span>

        {/* Year week progress bar: current week / total weeks */}
        <div className="mt-1 flex items-center gap-2">
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-1.5 rounded-full bg-slate-900 transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="text-[10px] font-medium text-slate-500">
            {week}/{totalWeeks}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={onCreateTask}
        className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow hover:bg-slate-800"
      >
        <span className="text-lg leading-none">＋</span>
        <span>New task</span>
      </button>
    </header>
  )
}
