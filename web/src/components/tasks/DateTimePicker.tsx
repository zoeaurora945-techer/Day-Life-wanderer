/**
 * @file DateTimePicker component.
 * @description Inline custom date + time picker with 10-minute granularity.
 * Renders a month calendar, hour list, and minute list (0/10/20/30/40/50).
 */

import type { FC } from 'react'
import { useEffect, useMemo, useState } from 'react'
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { roundToNearest10Minutes } from '../../utils/dateUtils'

/**
 * @description Props for DateTimePicker.
 */
export interface DateTimePickerProps {
  /**
   * @description Current value as ISO datetime string. Can be empty for "no selection".
   */
  value: string
  /**
   * @description Called when user selects a new datetime (already rounded to nearest 10 minutes).
   */
  onChange: (nextIso: string) => void
}

/**
 * @description Builds a matrix of calendar days for the month of `viewDate`.
 * Weeks start on Monday.
 */
function buildMonthMatrix(viewDate: Date): Date[][] {
  const monthStart = startOfMonth(viewDate)
  const monthEnd = endOfMonth(viewDate)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

  const days: Date[] = []
  let cursor = gridStart
  // Generate all days between gridStart and gridEnd inclusive.
  while (cursor <= gridEnd) {
    days.push(cursor)
    cursor = addDays(cursor, 1)
  }

  const weeks: Date[][] = []
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7))
  }
  return weeks
}

/**
 * @description Safely parses an ISO string; falls back to `fallback` if invalid.
 */
function parseIsoOrFallback(iso: string | null | undefined, fallback: Date): Date {
  if (!iso) return fallback
  const d = new Date(iso)
  // NaN check for invalid date.
  if (Number.isNaN(d.getTime())) return fallback
  return d
}

/**
 * @description Formats a Date as "YYYY年MM月".
 */
function formatYearMonthLabel(d: Date): string {
  const year = d.getFullYear()
  const month = d.getMonth() + 1
  return `${year}年${month.toString().padStart(2, '0')}月`
}

/**
 * @description Formats a Date as "YYYY/MM/DD HH:mm" for small display.
 */
function formatDateTimeLabel(d: Date): string {
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`)
  const year = d.getFullYear()
  const month = pad(d.getMonth() + 1)
  const day = pad(d.getDate())
  const hour = pad(d.getHours())
  const minute = pad(d.getMinutes())
  return `${year}/${month}/${day} ${hour}:${minute}`
}

/**
 * @description Inline calendar + hour/minute picker with 10-minute granularity.
 */
export const DateTimePicker: FC<DateTimePickerProps> = ({ value, onChange }) => {
  const now = useMemo(() => new Date(), [])
  const minutesOptions = [0, 10, 20, 30, 40, 50]

  // Selected date is derived from value or "now", rounded to 10 minutes for display.
  const selectedDate = useMemo(
    () => roundToNearest10Minutes(parseIsoOrFallback(value, now)),
    [value, now],
  )

  const [viewDate, setViewDate] = useState<Date>(selectedDate)

  // Keep calendar month in sync when selected date moves to a different month.
  useEffect(() => {
    if (!isSameMonth(selectedDate, viewDate)) {
      setViewDate(selectedDate)
    }
  }, [selectedDate, viewDate])

  const weeks = useMemo(() => buildMonthMatrix(viewDate), [viewDate])

  const selectedHour = selectedDate.getHours()
  const selectedMinute = selectedDate.getMinutes()

  /**
   * @description Emits a new ISO value rounded to nearest 10 minutes.
   */
  const emitDate = (draft: Date) => {
    const rounded = roundToNearest10Minutes(draft)
    onChange(rounded.toISOString())
  }

  /**
   * @description Handles day click in calendar.
   */
  const handleDayClick = (day: Date) => {
    const next = new Date(day)
    next.setHours(selectedHour, selectedMinute, 0, 0)
    emitDate(next)
  }

  /**
   * @description Handles hour click.
   */
  const handleHourClick = (hour: number) => {
    const next = new Date(selectedDate)
    next.setHours(hour)
    emitDate(next)
  }

  /**
   * @description Handles minute click (10-minute steps).
   */
  const handleMinuteClick = (minute: number) => {
    const next = new Date(selectedDate)
    next.setMinutes(minute)
    emitDate(next)
  }

  /**
   * @description Jumps to "today", rounded to nearest 10 minutes.
   */
  const handleToday = () => {
    const rounded = roundToNearest10Minutes(new Date())
    onChange(rounded.toISOString())
  }

  /**
   * @description Clears current selection by emitting empty string.
   */
  const handleClear = () => {
    onChange('')
  }

  return (
    <div className="mt-1 rounded-md border border-slate-200 bg-white p-2 shadow-sm">
      <div className="mb-2 flex items-center justify-between text-xs text-slate-600">
        <span className="font-medium text-slate-800">
          {formatDateTimeLabel(selectedDate)}
        </span>
        <span className="text-[11px]">10-minute steps</span>
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)_minmax(0,0.9fr)]">
        {/* Calendar column */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-700">
            <div className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-1">
              <span className="font-semibold">{formatYearMonthLabel(viewDate)}</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setViewDate((prev) => addMonths(prev, -1))}
                className="inline-flex h-6 w-6 items-center justify-center rounded border border-slate-200 text-xs text-slate-700 hover:bg-slate-50"
              >
                ←
              </button>
              <button
                type="button"
                onClick={() => setViewDate((prev) => addMonths(prev, 1))}
                className="inline-flex h-6 w-6 items-center justify-center rounded border border-slate-200 text-xs text-slate-700 hover:bg-slate-50"
              >
                →
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[11px]">
            {['一', '二', '三', '四', '五', '六', '日'].map((label) => (
              <div key={label} className="py-0.5 font-medium text-slate-500">
                {label}
              </div>
            ))}
            {weeks.map((week, wi) =>
              week.map((day) => {
                const isCurrentMonth = isSameMonth(day, viewDate)
                const isSelected = isSameDay(day, selectedDate)
                const isToday = isSameDay(day, now)

                return (
                  <button
                    key={`${wi}-${day.toISOString()}`}
                    type="button"
                    onClick={() => handleDayClick(day)}
                    className={[
                      'h-7 rounded-md text-xs',
                      isSelected
                        ? 'bg-slate-900 text-white font-semibold'
                        : isCurrentMonth
                          ? 'text-slate-800 hover:bg-slate-100'
                          : 'text-slate-300 hover:bg-slate-100',
                      isToday && !isSelected
                        ? 'border border-slate-400'
                        : 'border border-transparent',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {day.getDate()}
                  </button>
                )
              }),
            )}
          </div>

          <div className="flex items-center justify-between pt-1 text-[11px]">
            <button
              type="button"
              onClick={handleClear}
              className="rounded px-2 py-0.5 text-sky-700 hover:bg-sky-50"
            >
              清除
            </button>
            <button
              type="button"
              onClick={handleToday}
              className="rounded px-2 py-0.5 text-sky-700 hover:bg-sky-50"
            >
              今天
            </button>
          </div>
        </div>

        {/* Hour column */}
        <div className="flex flex-col">
          <p className="mb-1 text-[11px] font-medium text-slate-600">Hour</p>
          <div className="max-h-40 overflow-auto rounded-md border border-slate-200 bg-slate-50">
            {Array.from({ length: 24 }, (_, i) => i).map((hour) => {
              const isActive = hour === selectedHour
              return (
                <button
                  key={hour}
                  type="button"
                  onClick={() => handleHourClick(hour)}
                  className={[
                    'flex w-full items-center justify-center border-b border-slate-100 px-2 py-1 text-xs',
                    isActive
                      ? 'bg-slate-900 text-white font-semibold'
                      : 'bg-transparent text-slate-800 hover:bg-slate-100',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {hour.toString().padStart(2, '0')}
                </button>
              )
            })}
          </div>
        </div>

        {/* Minute column (10-minute steps) */}
        <div className="flex flex-col">
          <p className="mb-1 text-[11px] font-medium text-slate-600">Minute</p>
          <div className="max-h-40 overflow-auto rounded-md border border-slate-200 bg-slate-50">
            {minutesOptions.map((minute) => {
              const isActive = minute === selectedMinute
              return (
                <button
                  key={minute}
                  type="button"
                  onClick={() => handleMinuteClick(minute)}
                  className={[
                    'flex w-full items-center justify-center border-b border-slate-100 px-2 py-1 text-xs',
                    isActive
                      ? 'bg-slate-900 text-white font-semibold'
                      : 'bg-transparent text-slate-800 hover:bg-slate-100',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {minute.toString().padStart(2, '0')}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}