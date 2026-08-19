/**
 * @file HeaderBar component.
 * @description Displays today's date, current week index, weekday, week progress bar,
 * language switcher, and global "new task" trigger.
 */

import type { FC } from 'react'
import {
  formatDateKey,
  getWeekNumberOfYear,
  getWeekRangeForDate,
} from '../../utils/dateUtils'
import { useTaskStore } from '../../store/useTaskStore'
import { t, type Language } from '../../i18n/translations'

/**
 * @description Props for HeaderBar.
 */
export interface HeaderBarProps {
  now: Date
  onCreateTask: () => void
}

/**
 * @description Formats a Date into MM/DD using local time (no year).
 */
function formatMonthDay(date: Date): string {
  const month = date.getMonth() + 1
  const day = date.getDate()
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`)
  return `${pad(month)}/${pad(day)}`
}

/**
 * @description Returns weekday label based on language.
 */
function getWeekdayLabel(date: Date, lang: Language): string {
  const index = date.getDay()
  return t(lang, 'header.weekday', index)
}

/**
 * @description Top header showing weekday, date, week index, progress bar, and language switcher.
 */
export const HeaderBar: FC<HeaderBarProps> = ({ now, onCreateTask }) => {
  const { lang, setLang } = useTaskStore()
  const { start, end } = getWeekRangeForDate(now)
  const { week, totalWeeks } = getWeekNumberOfYear(now)

  const todayLabel = formatDateKey(now)
  const weekdayLabel = getWeekdayLabel(now, lang)
  const weekRangeLabel = `${formatMonthDay(start)}-${formatMonthDay(end)}`

  const progressFraction = totalWeeks === 0 ? 0 : week / totalWeeks
  const clampedFraction = Math.max(0, Math.min(1, progressFraction))
  const progressPct = Math.round(clampedFraction * 100)

  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white/90 px-6 py-4 backdrop-blur">
      <div className="flex flex-col">
        {/* Weekday */}
        <span className="text-sm font-medium text-slate-500">
          {weekdayLabel}
        </span>

        {/* Date */}
        <span className="text-xl font-semibold text-slate-900 mt-0.5">
          {todayLabel}
        </span>

        {/* Week info */}
        <span className="mt-1 text-sm text-slate-600">
          {t(lang, 'header.week')} {week} · {weekRangeLabel}
        </span>

        {/* Progress bar */}
        <div className="mt-2 flex items-center gap-3">
          <div className="h-2 w-32 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-2 rounded-full bg-slate-900 transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="text-sm font-medium text-slate-500">
            {t(lang, 'header.progress', week, totalWeeks)}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Language switcher */}
        <div className="flex items-center rounded-full border border-slate-200 bg-slate-50 p-0.5">
          <button
            onClick={() => setLang('zh')}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-all ${
              lang === 'zh'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            中
          </button>
          <button
            onClick={() => setLang('en')}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-all ${
              lang === 'en'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            EN
          </button>
        </div>

        {/* New task button */}
        <button
          type="button"
          onClick={onCreateTask}
          className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-4 py-2 text-base font-medium text-white shadow hover:bg-slate-800 transition-colors"
        >
          <span className="text-lg leading-none">＋</span>
          <span>{t(lang, 'header.new_task')}</span>
        </button>
      </div>
    </header>
  )
}
