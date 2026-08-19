/**
 * @file Date utilities (Taro / dependency-free port).
 * @description Helper functions for date-only keys, week ranges, time comparisons, week-of-year calculations, and 10-minute quantization.
 * Ported from the Web project; the two date-fns helpers (startOfWeek / endOfWeek) are reimplemented with native Date so the Mini Program has zero extra dependencies.
 */

/**
 * @description Number of milliseconds in one week.
 */
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000

/**
 * @description Formats a Date into YYYY-MM-DD using local time.
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
 */
export function getDateKeyFromIso(isoString: string): string {
  const d = new Date(isoString)
  return formatDateKey(d)
}

/**
 * @description Returns true if dateKeyA < dateKeyB lexicographically. Keys must be YYYY-MM-DD.
 */
export function isDateKeyBefore(dateKeyA: string, dateKeyB: string): boolean {
  return dateKeyA < dateKeyB
}

/**
 * @description Combines a YYYY-MM-DD local date key and an ISO datetime to a new ISO datetime
 * with the same local time component but new date component.
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
 * @description Native reimplementation of date-fns startOfWeek (weekStartsOn 0=Sun, 1=Mon...).
 */
function nativeStartOfWeek(date: Date, weekStartsOn: number): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay() // 0=Sun .. 6=Sat
  const diff = (day - weekStartsOn + 7) % 7
  d.setDate(d.getDate() - diff)
  return d
}

/**
 * @description Native reimplementation of date-fns endOfWeek (inclusive Sunday 23:59:59.999).
 */
function nativeEndOfWeek(date: Date, weekStartsOn: number): Date {
  const start = nativeStartOfWeek(date, weekStartsOn)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return end
}

/**
 * @description Returns the Monday and Sunday of the week for a given Date (local time).
 */
export function getWeekRangeForDate(date: Date): { start: Date; end: Date } {
  const start = nativeStartOfWeek(date, 1)
  const end = nativeEndOfWeek(date, 1)
  return { start, end }
}

/**
 * @description Checks whether an ISO datetime is within [weekStartDate, weekEndDate] (YYYY-MM-DD) inclusive.
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
 */
export function getWeekNumberOfYear(date: Date): {
  week: number
  totalWeeks: number
} {
  const year = date.getFullYear()
  const startOfFirstWeek = nativeStartOfWeek(new Date(year, 0, 1), 1)
  const startOfCurrentWeek = nativeStartOfWeek(date, 1)
  const diffToCurrent = startOfCurrentWeek.getTime() - startOfFirstWeek.getTime()
  const week = Math.floor(diffToCurrent / ONE_WEEK_MS) + 1
  const startOfLastWeek = nativeStartOfWeek(new Date(year, 11, 31), 1)
  const diffToLast = startOfLastWeek.getTime() - startOfFirstWeek.getTime()
  const totalWeeks = Math.floor(diffToLast / ONE_WEEK_MS) + 1
  return { week, totalWeeks }
}

/**
 * @description Rounds a Date instance to the nearest 10 minutes (seconds and ms dropped).
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

  if (adjustedMinutes >= 60) {
    d.setHours(d.getHours() + 1)
    adjustedMinutes = 0
  }

  d.setMinutes(adjustedMinutes)
  d.setSeconds(0)
  d.setMilliseconds(0)

  return d
}
