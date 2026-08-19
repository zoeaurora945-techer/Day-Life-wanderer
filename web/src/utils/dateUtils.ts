/**
 * @file Date utilities.
 * @description Helper functions for date-only keys, week ranges, time comparisons, week-of-year calculations, and 10-minute quantization.
 */

import { endOfWeek, startOfWeek } from 'date-fns'

/**
 * @description Number of milliseconds in one week.
 */
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000

/**
 * @description Formats a Date into YYYY-MM-DD using local time.
 * @param date - Date instance to format.
 * @returns A date string in the format YYYY-MM-DD.
 */
export function formatDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`)
  return `${year}-${pad(month)}-${pad(day)}`
}

/**
 * @description Extracts a YYYY-MM-DD key from an ISO datetime string using local time.
 * @param isoString - ISO datetime string.
 * @returns A date string in the format YYYY-MM-DD.
 */
export function getDateKeyFromIso(isoString: string): string {
  const d = new Date(isoString)
  return formatDateKey(d)
}

/**
 * @description Returns true if dateKeyA &lt; dateKeyB lexicographically. Keys must be YYYY-MM-DD.
 * @param dateKeyA - First date key.
 * @param dateKeyB - Second date key.
 * @returns True if A is before B.
 */
export function isDateKeyBefore(dateKeyA: string, dateKeyB: string): boolean {
  return dateKeyA < dateKeyB
}

/**
 * @description Combines a YYYY-MM-DD local date key and an ISO datetime to a new ISO datetime
 * with the same local time component but new date component.
 * @param dateKey - Date in YYYY-MM-DD format.
 * @param isoWithTime - ISO string whose time component is reused.
 * @returns Combined ISO datetime string (not automatically quantized).
 */
export function combineDateKeyWithTime(dateKey: string, isoWithTime: string): string {
  const [yearStr, monthStr, dayStr] = dateKey.split('-')
  const base = new Date(isoWithTime)
  const year = Number(yearStr)
  const month = Number(monthStr) - 1
  const day = Number(dayStr)
  const hours = base.getHours()
  const minutes = base.getMinutes()
  const seconds = base.getSeconds()
  const ms = base.getMilliseconds()
  const combined = new Date(year, month, day, hours, minutes, seconds, ms)
  return combined.toISOString()
}

/**
 * @description Returns the Monday and Sunday of the week for a given Date (local time).
 * @param date - Date for which to calculate week range.
 * @returns Object containing the start (Monday) and end (Sunday) dates of the week.
 */
export function getWeekRangeForDate(date: Date): { start: Date; end: Date } {
  const start = startOfWeek(date, { weekStartsOn: 1 })
  const end = endOfWeek(date, { weekStartsOn: 1 })
  return { start, end }
}

/**
 * @description Checks whether an ISO datetime is within [weekStartDate, weekEndDate] (YYYY-MM-DD) inclusive.
 * @param iso - ISO datetime string to check.
 * @param weekStartDate - Week start in YYYY-MM-DD format.
 * @param weekEndDate - Week end in YYYY-MM-DD format.
 * @returns True if the ISO date is within the given week range.
 */
export function isIsoWithinWeek(
  iso: string,
  weekStartDate: string,
  weekEndDate: string,
): boolean {
  const dateKey = getDateKeyFromIso(iso)
  return dateKey >= weekStartDate && dateKey <= weekEndDate
}

/**
 * @description Calculates the week number (starting from Jan 1) and total number of weeks for the year.
 *
 * Rules:
 * - Week starts on Monday.
 * - The week containing January 1st is Week 1.
 * - Weeks are counted continuously until the week containing December 31st.
 *
 * @param date - Date for which to calculate the week index and total weeks of the year.
 * @returns Object containing the current week index and total weeks in the year.
 */
export function getWeekNumberOfYear(
  date: Date,
): {
  week: number
  totalWeeks: number
} {
  const year = date.getFullYear()

  // Week that contains Jan 1 is Week 1 (may start in last year).
  const startOfFirstWeek = startOfWeek(new Date(year, 0, 1), { weekStartsOn: 1 })
  const startOfCurrentWeek = startOfWeek(date, { weekStartsOn: 1 })

  const diffToCurrent = startOfCurrentWeek.getTime() - startOfFirstWeek.getTime()
  const week = Math.floor(diffToCurrent / ONE_WEEK_MS) + 1

  // Total weeks: week index of the week containing Dec 31.
  const startOfLastWeek = startOfWeek(new Date(year, 11, 31), {
    weekStartsOn: 1,
  })
  const diffToLast = startOfLastWeek.getTime() - startOfFirstWeek.getTime()
  const totalWeeks = Math.floor(diffToLast / ONE_WEEK_MS) + 1

  return {
    week,
    totalWeeks,
  }
}

/**
 * @description Rounds a Date instance to the nearest 10 minutes (seconds and ms dropped).
 * Uses 5 minutes as the threshold (round-half-up).
 * @param date - Date to round.
 * @returns A new Date rounded to nearest 10 minutes.
 */
export function roundToNearest10Minutes(date: Date): Date {
  const d = new Date(date.getTime())
  const minutes = d.getMinutes()
  const remainder = minutes % 10
  let adjustedMinutes = minutes

  if (remainder < 5) {
    adjustedMinutes = minutes - remainder
  } else {
    adjustedMinutes = minutes + (10 - remainder)
  }

  // Handle hour overflow (e.g. 09:57 -&gt; 10:00).
  if (adjustedMinutes >= 60) {
    d.setHours(d.getHours() + 1)
    adjustedMinutes = 0
  }

  d.setMinutes(adjustedMinutes)
  d.setSeconds(0)
  d.setMilliseconds(0)

  return d
}