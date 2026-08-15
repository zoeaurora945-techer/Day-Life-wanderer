/**
 * @file Task and weekly review domain types.
 * @description Defines core data structures for tasks, goals, projects, graph edges, weekly reviews, and related enums.
 */

export type Importance = 'important' | 'not_important'

export type Category = 'research' | 'work' | 'life'

export type Status = 'todo' | 'done'

/**
 * @description Manual/automatic mode for urgent evaluation.
 */
export type UrgentMode = 'auto' | 'manual'

/**
 * @description Logical quadrant for Eisenhower matrix. Derived at runtime, not persisted.
 */
export type Quadrant =
  | 'Q1_IMPORTANT_URGENT'
  | 'Q2_NOTIMPORTANT_URGENT'
  | 'Q3_IMPORTANT_NOTURGENT'
  | 'Q4_NOTIMPORTANT_NOTURGENT'

/**
 * @description Core task entity representing a single item in the matrix, lists, and goal graph.
 */
export interface Task {
  id: string
  title: string
  createdAt: string // ISO datetime
  dueAt: string // ISO datetime, rounded to 10-minute granularity
  importance: Importance
  category: Category
  status: Status
  doneAt?: string | null // ISO datetime or null when not completed
  notes?: string

  /**
   * @description Urgent mode: auto (by due date) or manual (user override).
   */
  urgentMode: UrgentMode

  /**
   * @description Manual urgent flag when urgentMode === 'manual'. Null/undefined means not set.
   */
  urgentManual?: boolean | null
}

/**
 * @description User-defined long‑term goal node, typically representing life directions or big outcomes.
 */
export interface Goal {
  id: string
  title: string
  targetDueAt?: string // Optional ISO datetime or date-only
  createdAt: string // ISO datetime
  notes?: string
}

/**
 * @description Mid‑level project entity connecting long‑term goals and concrete tasks.
 * A project usually rolls up to a single goal (goalId), but this is optional.
 */
export interface Project {
  id: string
  title: string
  /**
   * @description Optional parent goal id; null/undefined means the project is not attached to any goal.
   */
  goalId?: string | null

  /**
   * @description Optional calendar start date (YYYY-MM-DD), date-only, representing when this project is intended to begin.
   */
  startDate?: string

  /**
   * @description Optional calendar end date (YYYY-MM-DD), date-only, representing when this project is intended to finish.
   */
  endDate?: string

  /**
   * @description Optional target due datetime, kept for backward compatibility; can be ISO datetime or date-only.
   */
  targetDueAt?: string

  createdAt: string // ISO datetime
  /**
   * @description Lightweight project status for high-level tracking.
   */
  status?: 'active' | 'paused' | 'completed'
  notes?: string
}

/**
 * @description Graph edge connecting nodes (goal, project, task).
 * This supports:
 * - goal ↔ project
 * - project ↔ task
 * - project ↔ project
 * - task ↔ task
 */
export interface GraphEdge {
  id: string
  fromType: 'task' | 'goal' | 'project'
  toType: 'task' | 'goal' | 'project'
  fromId: string
  toId: string
  relation: 'supports' | 'depends_on' | 'custom'
  createdAt: string // ISO datetime
}

/**
 * @description Weekly review free-form content and action items, one per week.
 */
export interface WeeklyReview {
  id: string
  weekStartDate: string // YYYY-MM-DD (Monday)
  weekEndDate: string // YYYY-MM-DD (Sunday)
  highlights: string
  blockers: string
  nextActions: WeeklyReviewActionItem[]
}

/**
 * @description Action item inside a weekly review. May be converted into a Task.
 */
export interface WeeklyReviewActionItem {
  id: string
  content: string
  linkedTaskId?: string | null
  status: 'pending' | 'converted'
}

/**
 * @description Meta information persisted for the application.
 */
export interface AppMeta {
  lastOpenDate?: string // YYYY-MM-DD, local calendar date
}