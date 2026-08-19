/**
 * @file Task and weekly review store using Zustand.
 * @description Central state management for tasks, goals, projects, graph edges, daily logs, weekly reviews, and app meta, with persistence and daily rollover.
 *
 * @changelog (v2 / 锚点小程序 MVP)
 * - STORAGE_KEY upgraded v1 → v2 ('anchor-app-state-v2'); old key kept as rollback.
 * - Added DailyLog persistence + addDailyLog(text) (calls rule parser → creates tasks).
 * - Task.status extended to three states; setTaskState(id, state) added.
 * - Goal auto-archive (30d inactivity) via autoArchiveCheck inside initializeForToday.
 * - buildState() helper centralises nextState construction so dailyLogs is never dropped.
 */

import { create } from 'zustand'
import type {
  AppMeta,
  DailyLog,
  GraphEdge,
  Goal,
  Project,
  Status,
  Task,
  WeeklyReview,
  WeeklyReviewActionItem,
} from '../types/task'
import {
  combineDateKeyWithTime,
  formatDateKey,
  getDateKeyFromIso,
  isDateKeyBefore,
  roundToNearest10Minutes,
} from '../utils/dateUtils'
import { parseInput } from '../shared/ai/ruleParser'

/**
 * @description Simple ID generator to avoid external dependencies like nanoid.
 */
function generateId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    // @ts-expect-error - runtime feature detection for crypto.randomUUID
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2, 10)
}

const STORAGE_KEY = 'anchor-app-state-v2'
const OLD_STORAGE_KEY = 'quadrant-task-app-state-v1'

/**
 * @description Persisted application state shape.
 */
interface PersistedState {
  tasks: Task[]
  weeklyReviews: WeeklyReview[]
  meta: AppMeta
  goals: Goal[]
  projects: Project[]
  graphEdges: GraphEdge[]
  dailyLogs: DailyLog[]
}

/**
 * @description Store public API.
 */
interface TaskStore extends PersistedState {
  lang: 'zh' | 'en'
  initializeForToday: (now: Date) => void

  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'doneAt'>) => string
  updateTask: (id: string, patch: Partial<Task>) => void
  toggleTaskStatus: (id: string) => void
  setTaskState: (id: string, state: Status) => void
  deleteTask: (id: string) => void

  addDailyLog: (text: string) => DailyLog | null

  upsertWeeklyReview: (weekStartDate: string, weekEndDate: string) => WeeklyReview
  updateWeeklyReview: (id: string, patch: Partial<WeeklyReview>) => void
  addNextAction: (reviewId: string, content: string) => void
  updateNextAction: (
    reviewId: string,
    actionId: string,
    patch: Partial<WeeklyReviewActionItem>,
  ) => void
  deleteNextAction: (reviewId: string, actionId: string) => void
  markNextActionConverted: (reviewId: string, actionId: string, taskId: string) => void

  addGoal: (payload: Omit<Goal, 'id' | 'createdAt'>) => string
  updateGoal: (id: string, patch: Partial<Goal>) => void
  deleteGoal: (id: string) => void
  archiveGoal: (id: string) => void

  addProject: (payload: Omit<Project, 'id' | 'createdAt'>) => string
  updateProject: (id: string, patch: Partial<Project>) => void
  deleteProject: (id: string) => void

  setTaskProject: (taskId: string, projectId: string | null) => void

  setLang: (lang: 'zh' | 'en') => void

  addGraphEdge: (payload: Omit<GraphEdge, 'id' | 'createdAt'>) => string
  deleteGraphEdge: (id: string) => void
}

/**
 * @description Builds the next persisted state from the current store, guaranteeing
 * every PersistedState field (incl. dailyLogs) is carried forward unless overridden.
 */
function buildState(get: () => TaskStore, override: Partial<PersistedState>): PersistedState {
  const s = get()
  return {
    tasks: s.tasks,
    weeklyReviews: s.weeklyReviews,
    meta: s.meta,
    goals: s.goals,
    projects: s.projects,
    graphEdges: s.graphEdges,
    dailyLogs: s.dailyLogs,
    ...override,
  }
}

/**
 * @description Persists and applies the next state.
 */
function persistAndSet(get: () => TaskStore, set: (s: PersistedState) => void, state: PersistedState): void {
  persistState(state)
  set(state)
}

/**
 * @description Normalises tasks loaded from storage to ensure urgent + v2 fields exist.
 */
function normalizeTasks(raw: unknown): Task[] {
  if (!Array.isArray(raw)) return []
  return (raw as any[]).map((item) => {
    const base = item as any
    const urgentMode = base.urgentMode === 'manual' ? 'manual' : 'auto'
    const urgentManual =
      'urgentManual' in base ? ((base.urgentManual as boolean | null) ?? null) : null
    const task: Task = {
      ...base,
      urgentMode,
      urgentManual,
      servesGoal: base.servesGoal ?? false,
      sourceLogId: base.sourceLogId ?? null,
    }
    return task
  })
}

/**
 * @description Normalises a v2 payload from storage.
 */
function normalizeV2(parsed: any): PersistedState {
  return {
    tasks: normalizeTasks(parsed.tasks),
    weeklyReviews: Array.isArray(parsed.weeklyReviews) ? parsed.weeklyReviews : [],
    meta: parsed.meta ?? {},
    goals: Array.isArray(parsed.goals)
      ? parsed.goals.map((g: any) => ({ ...g, status: g.status ?? 'active', lastActiveAt: g.lastActiveAt ?? g.createdAt }))
      : [],
    projects: Array.isArray(parsed.projects)
      ? parsed.projects.map((p: any) => ({ ...p, status: p.status ?? 'active', lastActiveAt: p.lastActiveAt ?? p.createdAt }))
      : [],
    graphEdges: Array.isArray(parsed.graphEdges) ? parsed.graphEdges : [],
    dailyLogs: Array.isArray(parsed.dailyLogs) ? parsed.dailyLogs : [],
  }
}

/**
 * @description Migrates an old v1 payload (quadrant-task-app-state-v1) into v2 shape.
 * Old key is preserved on disk as a rollback copy.
 */
function migrateV1ToV2(raw: any): PersistedState {
  return {
    tasks: normalizeTasks(raw.tasks),
    weeklyReviews: Array.isArray(raw.weeklyReviews) ? raw.weeklyReviews : [],
    meta: raw.meta ?? {},
    goals: Array.isArray(raw.goals)
      ? raw.goals.map((g: any) => ({ ...g, status: 'active', lastActiveAt: g.createdAt }))
      : [],
    projects: Array.isArray(raw.projects)
      ? raw.projects.map((p: any) => ({ ...p, status: p.status ?? 'active', lastActiveAt: p.createdAt }))
      : [],
    graphEdges: Array.isArray(raw.graphEdges) ? raw.graphEdges : [],
    dailyLogs: [],
  }
}

/**
 * @description Loads persisted state: v2 first, then v1 migration, then empty.
 */
function loadInitialState(): PersistedState {
  const empty: PersistedState = {
    tasks: [],
    weeklyReviews: [],
    meta: {},
    goals: [],
    projects: [],
    graphEdges: [],
    dailyLogs: [],
  }
  if (typeof window === 'undefined') return empty
  try {
    const rawV2 = window.localStorage.getItem(STORAGE_KEY)
    if (rawV2) return normalizeV2(JSON.parse(rawV2))
    const rawV1 = window.localStorage.getItem(OLD_STORAGE_KEY)
    if (rawV1) return migrateV1ToV2(JSON.parse(rawV1))
    return empty
  } catch {
    return empty
  }
}

/**
 * @description Persists the given state subset into localStorage.
 */
function persistState(state: PersistedState): void {
  if (typeof window === 'undefined') return
  try {
    const data: PersistedState = {
      tasks: state.tasks,
      weeklyReviews: state.weeklyReviews,
      meta: state.meta,
      goals: state.goals,
      projects: state.projects,
      graphEdges: state.graphEdges,
      dailyLogs: state.dailyLogs,
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // Swallow persistence errors to avoid breaking UI.
  }
}

/**
 * @description Computes the last activity timestamp of a goal from its child projects/tasks.
 */
function computeGoalLastActive(
  goalId: string,
  goals: Goal[],
  projects: Project[],
  tasks: Task[],
  edges: GraphEdge[],
): string | undefined {
  const goalProjects = projects.filter((p) => p.goalId === goalId)
  let maxTs = 0
  for (const p of goalProjects) {
    const pTs = p.createdAt ? new Date(p.createdAt).getTime() : 0
    if (pTs > maxTs) maxTs = pTs
    const taskIds = edges
      .filter(
        (e) =>
          (e.fromType === 'project' && e.fromId === p.id && e.toType === 'task') ||
          (e.toType === 'project' && e.toId === p.id && e.fromType === 'task'),
      )
      .map((e) => (e.fromType === 'task' ? e.fromId : e.toId))
    for (const tid of taskIds) {
      const t = tasks.find((x) => x.id === tid)
      if (t) {
        const ts = t.createdAt ? new Date(t.createdAt).getTime() : 0
        if (ts > maxTs) maxTs = ts
      }
    }
  }
  if (maxTs === 0) {
    const g = goals.find((x) => x.id === goalId)
    return g?.createdAt
  }
  return new Date(maxTs).toISOString()
}

/**
 * @description Auto-archives goals with no activity for 30+ days.
 */
function runAutoArchive(goals: Goal[], projects: Project[], tasks: Task[], edges: GraphEdge[]): Goal[] {
  const now = Date.now()
  const THIRTY_DAYS = 30 * 86400000
  return goals.map((g) => {
    if (g.status === 'archived') return g
    const last = computeGoalLastActive(g.id, goals, projects, tasks, edges)
    const lastTs = last ? new Date(last).getTime() : 0
    if (lastTs > 0 && now - lastTs > THIRTY_DAYS) {
      return { ...g, status: 'archived', lastActiveAt: last }
    }
    return { ...g, lastActiveAt: last ?? g.lastActiveAt }
  })
}

/**
 * @description Applies daily rollover (顺延革新) to todo tasks based on today's date key.
 */
function applyDailyRollover(tasks: Task[], todayKey: string): Task[] {
  return tasks.map((task) => {
    if (task.status !== 'todo') return task
    const dueKey = getDateKeyFromIso(task.dueAt)
    if (isDateKeyBefore(dueKey, todayKey)) {
      const combinedIso = combineDateKeyWithTime(todayKey, task.dueAt)
      const rounded = roundToNearest10Minutes(new Date(combinedIso))
      return { ...task, dueAt: rounded.toISOString() }
    }
    return task
  })
}

/**
 * @description Creates the main task store with business logic.
 */
export const useTaskStore = create<TaskStore>((set, get) => {
  const initial = loadInitialState()

  const store: TaskStore = {
    ...initial,
    lang: initial.meta.lang ?? 'zh',

    initializeForToday: (now: Date) => {
      const todayKey = formatDateKey(now)
      const s = get()
      if (s.meta.lastOpenDate === todayKey) return
      const rolled = applyDailyRollover(s.tasks, todayKey)
      const archivedGoals = runAutoArchive(s.goals, s.projects, rolled, s.graphEdges)
      const nextState = buildState(get, {
        tasks: rolled,
        goals: archivedGoals,
        meta: { ...s.meta, lastOpenDate: todayKey },
      })
      persistAndSet(get, set, nextState)
    },

    addTask: (payload) => {
      const now = new Date()
      const roundedDue = roundToNearest10Minutes(new Date(payload.dueAt))
      const newTask: Task = {
        ...payload,
        id: generateId(),
        createdAt: now.toISOString(),
        dueAt: roundedDue.toISOString(),
        doneAt: null,
      }
      const nextState = buildState(get, { tasks: [...get().tasks, newTask] })
      persistAndSet(get, set, nextState)
      return newTask.id
    },

    updateTask: (id, patch) => {
      const { tasks } = get()
      const normalizedPatch: Partial<Task> = { ...patch }
      if (patch.dueAt) {
        const rounded = roundToNearest10Minutes(new Date(patch.dueAt))
        normalizedPatch.dueAt = rounded.toISOString()
      }
      const nextTasks = tasks.map((t) => (t.id === id ? { ...t, ...normalizedPatch } : t))
      persistAndSet(get, set, buildState(get, { tasks: nextTasks }))
    },

    toggleTaskStatus: (id) => {
      const { tasks } = get()
      const nowIso = new Date().toISOString()
      const nextTasks = tasks.map((t) => {
        if (t.id !== id) return t
        if (t.status === 'done') return { ...t, status: 'todo', doneAt: null }
        return { ...t, status: 'done', doneAt: nowIso }
      })
      persistAndSet(get, set, buildState(get, { tasks: nextTasks }))
    },

    setTaskState: (id, state) => {
      const { tasks } = get()
      const nextTasks = tasks.map((t) => {
        if (t.id !== id) return t
        return {
          ...t,
          status: state,
          doneAt: state === 'done' ? new Date().toISOString() : null,
        }
      })
      persistAndSet(get, set, buildState(get, { tasks: nextTasks }))
    },

    deleteTask: (id) => {
      const { tasks, graphEdges } = get()
      const nextTasks = tasks.filter((t) => t.id !== id)
      const nextEdges = graphEdges.filter(
        (e) =>
          !(
            (e.fromType === 'task' && e.fromId === id) ||
            (e.toType === 'task' && e.toId === id)
          ),
      )
      persistAndSet(get, set, buildState(get, { tasks: nextTasks, graphEdges: nextEdges }))
    },

    addDailyLog: (text) => {
      const trimmed = (text || '').trim()
      if (!trimmed) return null
      const { projects, goals } = get()
      const result = parseInput(trimmed, { projects, goals })
      const createdTaskIds: string[] = []
      for (const pt of result.tasks) {
        const id = get().addTask({
          title: pt.title,
          importance: pt.importance,
          category: pt.category,
          status: 'todo',
          dueAt: pt.dueAt,
          notes: pt.notes ?? '',
          urgentMode: 'auto',
          urgentManual: null,
          servesGoal: pt.servesGoal,
          sourceLogId: null,
        })
        createdTaskIds.push(id)
        if (pt.projectId) get().setTaskProject(id, pt.projectId)
      }
      const now = new Date()
      const log: DailyLog = {
        id: generateId(),
        userText: trimmed,
        audioUrl: null,
        parsedTaskIds: createdTaskIds,
        createdAt: now.toISOString(),
      }
      const s = get()
      const tasksWithSource = s.tasks.map((t) =>
        createdTaskIds.includes(t.id) ? { ...t, sourceLogId: log.id } : t,
      )
      const nextState = buildState(get, {
        tasks: tasksWithSource,
        dailyLogs: [...s.dailyLogs, log],
      })
      persistAndSet(get, set, nextState)
      return log
    },

    upsertWeeklyReview: (weekStartDate, weekEndDate) => {
      const { weeklyReviews } = get()
      const existing = weeklyReviews.find(
        (r) => r.weekStartDate === weekStartDate && r.weekEndDate === weekEndDate,
      )
      if (existing) return existing
      const review: WeeklyReview = {
        id: generateId(),
        weekStartDate,
        weekEndDate,
        highlights: '',
        blockers: '',
        nextActions: [],
      }
      persistAndSet(get, set, buildState(get, { weeklyReviews: [...get().weeklyReviews, review] }))
      return review
    },

    updateWeeklyReview: (id, patch) => {
      const { weeklyReviews } = get()
      const nextWeekly = weeklyReviews.map((r) => (r.id === id ? { ...r, ...patch } : r))
      persistAndSet(get, set, buildState(get, { weeklyReviews: nextWeekly }))
    },

    addNextAction: (reviewId, content) => {
      const { weeklyReviews } = get()
      const nextWeekly = weeklyReviews.map((r) => {
        if (r.id !== reviewId) return r
        const action: WeeklyReviewActionItem = {
          id: generateId(),
          content,
          linkedTaskId: null,
          status: 'pending',
        }
        return { ...r, nextActions: [...r.nextActions, action] }
      })
      persistAndSet(get, set, buildState(get, { weeklyReviews: nextWeekly }))
    },

    updateNextAction: (reviewId, actionId, patch) => {
      const { weeklyReviews } = get()
      const nextWeekly = weeklyReviews.map((r) => {
        if (r.id !== reviewId) return r
        const nextActions = r.nextActions.map((a) =>
          a.id === actionId ? { ...a, ...patch } : a,
        )
        return { ...r, nextActions }
      })
      persistAndSet(get, set, buildState(get, { weeklyReviews: nextWeekly }))
    },

    deleteNextAction: (reviewId, actionId) => {
      const { weeklyReviews } = get()
      const nextWeekly = weeklyReviews.map((r) => {
        if (r.id !== reviewId) return r
        const nextActions = r.nextActions.filter((a) => a.id !== actionId)
        return { ...r, nextActions }
      })
      persistAndSet(get, set, buildState(get, { weeklyReviews: nextWeekly }))
    },

    markNextActionConverted: (reviewId, actionId, taskId) => {
      const { weeklyReviews } = get()
      const nextWeekly = weeklyReviews.map((r) => {
        if (r.id !== reviewId) return r
        const nextActions = r.nextActions.map((a) =>
          a.id === actionId ? { ...a, linkedTaskId: taskId, status: 'converted' } : a,
        )
        return { ...r, nextActions }
      })
      persistAndSet(get, set, buildState(get, { weeklyReviews: nextWeekly }))
    },

    addGoal: (payload) => {
      const { goals } = get()
      const now = new Date()
      const newGoal: Goal = {
        ...payload,
        id: generateId(),
        createdAt: now.toISOString(),
        status: payload.status ?? 'active',
      }
      persistAndSet(get, set, buildState(get, { goals: [...get().goals, newGoal] }))
      return newGoal.id
    },

    updateGoal: (id, patch) => {
      const { goals } = get()
      const nextGoals = goals.map((g) => (g.id === id ? { ...g, ...patch } : g))
      persistAndSet(get, set, buildState(get, { goals: nextGoals }))
    },

    deleteGoal: (id) => {
      const { goals, graphEdges } = get()
      const nextGoals = goals.filter((g) => g.id !== id)
      const nextEdges = graphEdges.filter(
        (e) =>
          !(
            (e.fromType === 'goal' && e.fromId === id) ||
            (e.toType === 'goal' && e.toId === id)
          ),
      )
      persistAndSet(get, set, buildState(get, { goals: nextGoals, graphEdges: nextEdges }))
    },

    archiveGoal: (id) => {
      get().updateGoal(id, { status: 'archived' })
    },

    addProject: (payload) => {
      const { projects } = get()
      const now = new Date()
      const newProject: Project = {
        ...payload,
        id: generateId(),
        createdAt: now.toISOString(),
        status: payload.status ?? 'active',
      }
      persistAndSet(get, set, buildState(get, { projects: [...get().projects, newProject] }))
      return newProject.id
    },

    updateProject: (id, patch) => {
      const { projects } = get()
      const nextProjects = projects.map((p) => (p.id === id ? { ...p, ...patch } : p))
      persistAndSet(get, set, buildState(get, { projects: nextProjects }))
    },

    deleteProject: (id) => {
      const { projects, graphEdges } = get()
      const nextProjects = projects.filter((p) => p.id !== id)
      const nextEdges = graphEdges.filter(
        (e) =>
          !(
            (e.fromType === 'project' && e.fromId === id) ||
            (e.toType === 'project' && e.toId === id)
          ),
      )
      persistAndSet(get, set, buildState(get, { projects: nextProjects, graphEdges: nextEdges }))
    },

    setTaskProject: (taskId, projectId) => {
      const { graphEdges } = get()
      let nextEdges = graphEdges.filter(
        (e) =>
          !(
            (e.fromType === 'task' &&
              e.fromId === taskId &&
              e.toType === 'project') ||
            (e.toType === 'task' &&
              e.toId === taskId &&
              e.fromType === 'project')
          ),
      )
      if (projectId) {
        const now = new Date()
        const newEdge: GraphEdge = {
          id: generateId(),
          fromType: 'task',
          fromId: taskId,
          toType: 'project',
          toId: projectId,
          relation: 'supports',
          createdAt: now.toISOString(),
        }
        nextEdges = [...nextEdges, newEdge]
      }
      persistAndSet(get, set, buildState(get, { graphEdges: nextEdges }))
    },

    addGraphEdge: (payload) => {
      const { graphEdges } = get()
      const now = new Date()
      const newEdge: GraphEdge = {
        ...payload,
        id: generateId(),
        createdAt: now.toISOString(),
      }
      persistAndSet(get, set, buildState(get, { graphEdges: [...get().graphEdges, newEdge] }))
      return newEdge.id
    },

    deleteGraphEdge: (id) => {
      const { graphEdges } = get()
      const nextEdges = graphEdges.filter((e) => e.id !== id)
      persistAndSet(get, set, buildState(get, { graphEdges: nextEdges }))
    },

    setLang: (lang) => {
      const { meta } = get()
      persistAndSet(get, set, buildState(get, { meta: { ...meta, lang } }))
    },
  }

  // Initial persistence to normalize state structure.
  persistState({
    tasks: store.tasks,
    weeklyReviews: store.weeklyReviews,
    meta: store.meta,
    goals: store.goals,
    projects: store.projects,
    graphEdges: store.graphEdges,
    dailyLogs: store.dailyLogs,
  })

  return store
})

// Ensure persistence on every state change.
useTaskStore.subscribe((state) => {
  persistState({
    tasks: state.tasks,
    weeklyReviews: state.weeklyReviews,
    meta: state.meta,
    goals: state.goals,
    projects: state.projects,
    graphEdges: state.graphEdges,
    dailyLogs: state.dailyLogs,
  })
})
