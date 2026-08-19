/**
 * @file Task utilities.
 * @description Helper functions for urgent evaluation, quadrant classification, and statistics.
 */

import type { Quadrant, Task } from '../types/task'
import { formatDateKey, getDateKeyFromIso, isIsoWithinWeek } from './dateUtils'

/**
 * @description Returns today's date key YYYY-MM-DD for a given Date using local time.
 */
export function getTodayKey(now: Date): string {
  return formatDateKey(now)
}

/**
 * @description Determines auto urgent flag based on remaining time to dueAt.
 * A task is considered urgent when:
 * - it is already overdue, or
 * - the remaining time until dueAt is less than or equal to 3 hours.
 */
export function computeUrgentAuto(task: Task, now: Date): boolean {
  const dueTime = new Date(task.dueAt).getTime()
  const nowTime = now.getTime()
  if (Number.isNaN(dueTime)) return false

  const diffMs = dueTime - nowTime
  const threeHoursMs = 3 * 60 * 60 * 1000

  // Overdue tasks are always treated as urgent.
  if (diffMs <= 0) return true

  // Within the next 3 hours becomes urgent automatically.
  return diffMs <= threeHoursMs
}

/**
 * @description Determines effective urgent flag, respecting manual override when enabled.
 */
export function computeUrgent(task: Task, now: Date): boolean {
  if (task.status !== 'todo') return false

  if (task.urgentMode === 'manual') {
    return Boolean(task.urgentManual)
  }

  return computeUrgentAuto(task, now)
}

/**
 * @description Computes the quadrant for a todo task based on importance and urgency.
 * Returns null for done tasks.
 */
export function getTaskQuadrant(task: Task, now: Date): Quadrant | null {
  if (task.status !== 'todo') return null
  const urgent = computeUrgent(task, now)

  if (task.importance === 'important' && urgent) return 'Q1_IMPORTANT_URGENT'
  if (task.importance === 'not_important' && urgent)
    return 'Q2_NOTIMPORTANT_URGENT'
  if (task.importance === 'important' && !urgent)
    return 'Q3_IMPORTANT_NOTURGENT'
  return 'Q4_NOTIMPORTANT_NOTURGENT'
}

/**
 * @description Returns true when an ISO createdAt is in the specified week interval.
 */
export function isCreatedInWeek(
  createdAt: string,
  weekStartDate: string,
  weekEndDate: string,
): boolean {
  return isIsoWithinWeek(createdAt, weekStartDate, weekEndDate)
}

/**
 * @description Statistics result for weekly progress.
 */
export interface WeeklyCategoryStats {
  created: number
  done: number
}

/**
 * @description Aggregates weekly stats for a category, based on creation time and current status.
 */
export function getWeeklyCategoryStats(
  tasks: Task[],
  weekStartDate: string,
  weekEndDate: string,
  category: Task['category'],
): WeeklyCategoryStats {
  let created = 0
  let done = 0

  for (const task of tasks) {
    if (task.category !== category) continue
    if (!isCreatedInWeek(task.createdAt, weekStartDate, weekEndDate)) continue
    created += 1
    if (task.status === 'done') done += 1
  }

  return { created, done }
}

/**
 * @description Computes overall progress fraction for all tasks.
 * Returns null when there is no task.
 */
export function getOverallProgress(tasks: Task[]): number | null {
  const total = tasks.length
  if (total === 0) return null
  const done = tasks.filter((t) => t.status === 'done').length
  return done / total
}

/**
 * @description Computes overall progress fraction for a specific category.
 * Returns null when there is no task in that category.
 */
export function getOverallCategoryProgress(
  tasks: Task[],
  category: Task['category'],
): number | null {
  const relevant = tasks.filter((t) => t.category === category)
  if (relevant.length === 0) return null
  const done = relevant.filter((t) => t.status === 'done').length
  return done / relevant.length
}
