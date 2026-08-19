/**
 * @file Task and weekly review domain types.
 * @description Defines core data structures for tasks, goals, projects, graph edges, daily logs, weekly reviews, and related enums.
 *
 * @changelog (v2 / 锚点小程序 MVP)
 * - Task.status 扩为三态 'todo' | 'doing' | 'done'（原二态兼容）
 * - Task 新增 servesGoal / sourceLogId
 * - Goal 新增 desc / color / status:'archived' / lastActiveAt
 * - Project 新增 goalIdSecondary / lastActiveAt / status:'archived'
 * - GraphEdge 新增 relation 'cross_galaxy' 与 strength（承载星系间弱连接）
 * - 新增 DailyLog 实体（散点 / 每天说一句）
 */

export type Importance = 'important' | 'not_important'

export type Category = 'research' | 'work' | 'life'

/**
 * @description Task lifecycle state.
 * 三态：todo(未开始 □) / doing(进行中 ▓) / done(完成 ✓)
 * 兼容旧数据：旧 'done' 直接沿用，旧无 doing 概念（仅 todo/done）。
 */
export type Status = 'todo' | 'doing' | 'done'

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

  /**
   * @description Whether this task serves a life-direction anchor (人生主线).
   * Set by rule/AI parser when the user's input mentions 主线/锚点/belong-to-goal.
   */
  servesGoal?: boolean

  /**
   * @description Source DailyLog id when this task was created from a chat input ("每天说一句").
   * Null/undefined when created manually. Enables traceability from log → tasks.
   */
  sourceLogId?: string | null
}

/**
 * @description User-defined long‑term goal node, typically representing life directions or big outcomes.
 * In the galaxy view it renders as a glowing star.
 */
export interface Goal {
  id: string
  title: string
  /**
   * @description Free-form description of the life direction.
   */
  desc?: string
  /**
   * @description Galaxy light color theme key, e.g. 'blue_gold' | 'purple_silver' | 'teal_white'.
   */
  color?: string
  /**
   * @description Archive state. Defaults to 'active'. Auto-archived after 30 days of inactivity.
   */
  status?: 'active' | 'archived'
  /**
   * @description ISO datetime of the last activity under this goal (derived from child projects/tasks).
   */
  lastActiveAt?: string
  targetDueAt?: string // Optional ISO datetime or date-only
  createdAt: string // ISO datetime
  notes?: string
}

/**
 * @description Mid‑level project entity connecting long‑term goals and concrete tasks.
 * In the galaxy view it renders as a planet orbiting its parent star (goal).
 */
export interface Project {
  id: string
  title: string
  /**
   * @description Optional parent goal id; null/undefined means the project is not attached to any goal.
   */
  goalId?: string | null

  /**
   * @description Optional secondary goal id, representing a weak cross-galaxy connection.
   */
  goalIdSecondary?: string | null

  /**
   * @description ISO datetime of the last activity under this project (derived from child tasks).
   */
  lastActiveAt?: string

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
  status?: 'active' | 'paused' | 'completed' | 'archived'
  notes?: string
}

/**
 * @description Graph edge connecting nodes (goal, project, task).
 * Supports goal ↔ project, project ↔ task, project ↔ project, task ↔ task.
 * Also carries cross-galaxy weak links (relation='cross_galaxy', strength 0-1).
 */
export interface GraphEdge {
  id: string
  fromType: 'task' | 'goal' | 'project'
  toType: 'task' | 'goal' | 'project'
  fromId: string
  toId: string
  relation: 'supports' | 'depends_on' | 'cross_galaxy' | 'custom'
  /**
   * @description Connection strength 0-1, used for cross-galaxy links (星系间引力强弱).
   */
  strength?: number
  createdAt: string // ISO datetime
}

/**
 * @description A "每天说一句" entry (散点). Captures raw user text and the tasks it produced.
 */
export interface DailyLog {
  id: string
  /**
   * @description Raw user text from chat input.
   */
  userText: string
  /**
   * @description Optional voice note URL (future: WeChat speech-to-text).
   */
  audioUrl?: string | null
  /**
   * @description Ids of tasks created from this log entry (by rule/AI parser).
   */
  parsedTaskIds: string[]
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
