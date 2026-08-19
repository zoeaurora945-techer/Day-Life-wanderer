/**
 * @file Task and weekly review store using Zustand (Taro port).
 * @description Central state management for tasks, goals, projects, graph edges, weekly reviews, and app meta, with persistence and daily rollover.
 * Ported from the Web project: business logic is byte-for-byte identical. Only the persistence layer
 * (window.localStorage -> Taro storage) and the ID generator (crypto -> safe fallback) are platform-specific.
 */

import { create } from 'zustand'
import type {
  AppMeta,
  GraphEdge,
  Goal,
  Project,
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
import { loadState, saveState } from '../storage'

/**
 * @description Simple ID generator (no external deps). Date prefix keeps IDs sortable-ish and unique enough for local use.
 */
function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

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
}

/**
 * @description Store public API.
 */
interface TaskStore extends PersistedState {
  initializeForToday: (now: Date) => void

  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'doneAt'>) => string
  updateTask: (id: string, patch: Partial<Task>) => void
  toggleTaskStatus: (id: string) => void
  deleteTask: (id: string) => void

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

  addProject: (payload: Omit<Project, 'id' | 'createdAt'>) => string
  updateProject: (id: string, patch: Partial<Project>) => void
  deleteProject: (id: string) => void

  setTaskProject: (taskId: string, projectId: string | null) => void

  addGraphEdge: (payload: Omit<GraphEdge, 'id' | 'createdAt'>) => string
  deleteGraphEdge: (id: string) => void
}

/**
 * @description Normalises tasks loaded from storage to ensure urgent fields exist.
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
    }
    return task
  })
}

/**
 * @description Loads persisted state from Taro storage, or returns an empty default.
 */
function loadInitialState(): PersistedState {
  const empty: PersistedState = {
    tasks: [],
    weeklyReviews: [],
    meta: {},
    goals: [],
    projects: [],
    graphEdges: [],
  }
  try {
    const parsed = loadState<Partial<PersistedState>>()
    if (!parsed) return empty
    return {
      tasks: normalizeTasks(parsed.tasks),
      weeklyReviews: parsed.weeklyReviews ?? [],
      meta: parsed.meta ?? {},
      goals: Array.isArray(parsed.goals) ? (parsed.goals as Goal[]) : [],
      projects: Array.isArray(parsed.projects) ? (parsed.projects as Project[]) : [],
      graphEdges: Array.isArray(parsed.graphEdges)
        ? (parsed.graphEdges as GraphEdge[])
        : [],
    }
  } catch {
    return empty
  }
}

/**
 * @description Persists the given state subset into Taro storage.
 */
function persistState(state: PersistedState): void {
  try {
    const data: PersistedState = {
      tasks: state.tasks,
      weeklyReviews: state.weeklyReviews,
      meta: state.meta,
      goals: state.goals,
      projects: state.projects,
      graphEdges: state.graphEdges,
    }
    saveState(data)
  } catch {
    // Swallow persistence errors to avoid breaking UI.
  }
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
 * @description Creates the main task store with business logic for tasks, goals, projects, graph edges and weekly reviews.
 */
export const useTaskStore = create<TaskStore>((set, get) => {
  const initial = loadInitialState()

  const store: TaskStore = {
    ...initial,

    initializeForToday: (now: Date) => {
      const todayKey = formatDateKey(now)
      const { meta, tasks, weeklyReviews, goals, projects, graphEdges } = get()
      if (meta.lastOpenDate === todayKey) return
      const rolled = applyDailyRollover(tasks, todayKey)
      const nextState: PersistedState = {
        tasks: rolled,
        weeklyReviews,
        meta: { ...meta, lastOpenDate: todayKey },
        goals,
        projects,
        graphEdges,
      }
      persistState(nextState)
      set(nextState)
    },

    addTask: (payload) => {
      const { tasks, weeklyReviews, meta, goals, projects, graphEdges } = get()
      const now = new Date()
      const roundedDue = roundToNearest10Minutes(new Date(payload.dueAt))
      const newTask: Task = {
        ...payload,
        id: generateId(),
        createdAt: now.toISOString(),
        dueAt: roundedDue.toISOString(),
        doneAt: null,
      }
      const nextState: PersistedState = {
        tasks: [...tasks, newTask],
        weeklyReviews,
        meta,
        goals,
        projects,
        graphEdges,
      }
      persistState(nextState)
      set(nextState)
      return newTask.id
    },

    updateTask: (id, patch) => {
      const { tasks, weeklyReviews, meta, goals, projects, graphEdges } = get()
      const normalizedPatch: Partial<Task> = { ...patch }

      if (patch.dueAt) {
        const rounded = roundToNearest10Minutes(new Date(patch.dueAt))
        normalizedPatch.dueAt = rounded.toISOString()
      }

      const nextTasks = tasks.map((t) => (t.id === id ? { ...t, ...normalizedPatch } : t))
      const nextState: PersistedState = {
        tasks: nextTasks,
        weeklyReviews,
        meta,
        goals,
        projects,
        graphEdges,
      }
      persistState(nextState)
      set(nextState)
    },

    toggleTaskStatus: (id) => {
      const { tasks, weeklyReviews, meta, goals, projects, graphEdges } = get()
      const nowIso = new Date().toISOString()
      const nextTasks = tasks.map((t) => {
        if (t.id !== id) return t
        if (t.status === 'todo') {
          return { ...t, status: 'done', doneAt: nowIso }
        }
        return { ...t, status: 'todo', doneAt: null }
      })
      const nextState: PersistedState = {
        tasks: nextTasks,
        weeklyReviews,
        meta,
        goals,
        projects,
        graphEdges,
      }
      persistState(nextState)
      set(nextState)
    },

    deleteTask: (id) => {
      const { tasks, weeklyReviews, meta, goals, projects, graphEdges } = get()
      const nextTasks = tasks.filter((t) => t.id !== id)
      const nextEdges = graphEdges.filter(
        (e) =>
          !(
            (e.fromType === 'task' && e.fromId === id) ||
            (e.toType === 'task' && e.toId === id)
          ),
      )
      const nextState: PersistedState = {
        tasks: nextTasks,
        weeklyReviews,
        meta,
        goals,
        projects,
        graphEdges: nextEdges,
      }
      persistState(nextState)
      set(nextState)
    },

    upsertWeeklyReview: (weekStartDate, weekEndDate) => {
      const { weeklyReviews, tasks, meta, goals, projects, graphEdges } = get()
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
      const nextWeekly = [...weeklyReviews, review]
      const nextState: PersistedState = {
        tasks,
        weeklyReviews: nextWeekly,
        meta,
        goals,
        projects,
        graphEdges,
      }
      persistState(nextState)
      set(nextState)
      return review
    },

    updateWeeklyReview: (id, patch) => {
      const { weeklyReviews, tasks, meta, goals, projects, graphEdges } = get()
      const nextWeekly = weeklyReviews.map((r) => (r.id === id ? { ...r, ...patch } : r))
      const nextState: PersistedState = {
        tasks,
        weeklyReviews: nextWeekly,
        meta,
        goals,
        projects,
        graphEdges,
      }
      persistState(nextState)
      set(nextState)
    },

    addNextAction: (reviewId, content) => {
      const { weeklyReviews, tasks, meta, goals, projects, graphEdges } = get()
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
      const nextState: PersistedState = {
        tasks,
        weeklyReviews: nextWeekly,
        meta,
        goals,
        projects,
        graphEdges,
      }
      persistState(nextState)
      set(nextState)
    },

    updateNextAction: (reviewId, actionId, patch) => {
      const { weeklyReviews, tasks, meta, goals, projects, graphEdges } = get()
      const nextWeekly = weeklyReviews.map((r) => {
        if (r.id !== reviewId) return r
        const nextActions = r.nextActions.map((a) =>
          a.id === actionId ? { ...a, ...patch } : a,
        )
        return { ...r, nextActions }
      })
      const nextState: PersistedState = {
        tasks,
        weeklyReviews: nextWeekly,
        meta,
        goals,
        projects,
        graphEdges,
      }
      persistState(nextState)
      set(nextState)
    },

    deleteNextAction: (reviewId, actionId) => {
      const { weeklyReviews, tasks, meta, goals, projects, graphEdges } = get()
      const nextWeekly = weeklyReviews.map((r) => {
        if (r.id !== reviewId) return r
        const nextActions = r.nextActions.filter((a) => a.id !== actionId)
        return { ...r, nextActions }
      })
      const nextState: PersistedState = {
        tasks,
        weeklyReviews: nextWeekly,
        meta,
        goals,
        projects,
        graphEdges,
      }
      persistState(nextState)
      set(nextState)
    },

    markNextActionConverted: (reviewId, actionId, taskId) => {
      const { weeklyReviews, tasks, meta, goals, projects, graphEdges } = get()
      const nextWeekly = weeklyReviews.map((r) => {
        if (r.id !== reviewId) return r
        const nextActions = r.nextActions.map((a) =>
          a.id === actionId ? { ...a, linkedTaskId: taskId, status: 'converted' } : a,
        )
        return { ...r, nextActions }
      })
      const nextState: PersistedState = {
        tasks,
        weeklyReviews: nextWeekly,
        meta,
        goals,
        projects,
        graphEdges,
      }
      persistState(nextState)
      set(nextState)
    },

    addGoal: (payload) => {
      const { goals, projects, tasks, weeklyReviews, meta, graphEdges } = get()
      const now = new Date()
      const newGoal: Goal = {
        ...payload,
        id: generateId(),
        createdAt: now.toISOString(),
      }
      const nextState: PersistedState = {
        tasks,
        weeklyReviews,
        meta,
        goals: [...goals, newGoal],
        projects,
        graphEdges,
      }
      persistState(nextState)
      set(nextState)
      return newGoal.id
    },

    updateGoal: (id, patch) => {
      const { goals, projects, tasks, weeklyReviews, meta, graphEdges } = get()
      const nextGoals = goals.map((g) => (g.id === id ? { ...g, ...patch } : g))
      const nextState: PersistedState = {
        tasks,
        weeklyReviews,
        meta,
        goals: nextGoals,
        projects,
        graphEdges,
      }
      persistState(nextState)
      set(nextState)
    },

    deleteGoal: (id) => {
      const { goals, projects, tasks, weeklyReviews, meta, graphEdges } = get()
      const nextGoals = goals.filter((g) => g.id !== id)
      const nextEdges = graphEdges.filter(
        (e) =>
          !(
            (e.fromType === 'goal' && e.fromId === id) ||
            (e.toType === 'goal' && e.toId === id)
          ),
      )
      const nextState: PersistedState = {
        tasks,
        weeklyReviews,
        meta,
        goals: nextGoals,
        projects,
        graphEdges: nextEdges,
      }
      persistState(nextState)
      set(nextState)
    },

    addProject: (payload) => {
      const { projects, tasks, weeklyReviews, meta, goals, graphEdges } = get()
      const now = new Date()
      const newProject: Project = {
        ...payload,
        id: generateId(),
        createdAt: now.toISOString(),
      }
      const nextState: PersistedState = {
        tasks,
        weeklyReviews,
        meta,
        goals,
        projects: [...projects, newProject],
        graphEdges,
      }
      persistState(nextState)
      set(nextState)
      return newProject.id
    },

    updateProject: (id, patch) => {
      const { projects, tasks, weeklyReviews, meta, goals, graphEdges } = get()
      const nextProjects = projects.map((p) => (p.id === id ? { ...p, ...patch } : p))
      const nextState: PersistedState = {
        tasks,
        weeklyReviews,
        meta,
        goals,
        projects: nextProjects,
        graphEdges,
      }
      persistState(nextState)
      set(nextState)
    },

    deleteProject: (id) => {
      const { projects, tasks, weeklyReviews, meta, goals, graphEdges } = get()
      const nextProjects = projects.filter((p) => p.id !== id)
      const nextEdges = graphEdges.filter(
        (e) =>
          !(
            (e.fromType === 'project' && e.fromId === id) ||
            (e.toType === 'project' && e.toId === id)
          ),
      )
      const nextState: PersistedState = {
        tasks,
        weeklyReviews,
        meta,
        goals,
        projects: nextProjects,
        graphEdges: nextEdges,
      }
      persistState(nextState)
      set(nextState)
    },

    setTaskProject: (taskId, projectId) => {
      const { graphEdges, tasks, weeklyReviews, meta, goals, projects } = get()

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

      const nextState: PersistedState = {
        tasks,
        weeklyReviews,
        meta,
        goals,
        projects,
        graphEdges: nextEdges,
      }
      persistState(nextState)
      set(nextState)
    },

    addGraphEdge: (payload) => {
      const { graphEdges, tasks, weeklyReviews, meta, goals, projects } = get()
      const now = new Date()
      const newEdge: GraphEdge = {
        ...payload,
        id: generateId(),
        createdAt: now.toISOString(),
      }
      const nextState: PersistedState = {
        tasks,
        weeklyReviews,
        meta,
        goals,
        projects,
        graphEdges: [...graphEdges, newEdge],
      }
      persistState(nextState)
      set(nextState)
      return newEdge.id
    },

    deleteGraphEdge: (id) => {
      const { graphEdges, tasks, weeklyReviews, meta, goals, projects } = get()
      const nextEdges = graphEdges.filter((e) => e.id !== id)
      const nextState: PersistedState = {
        tasks,
        weeklyReviews,
        meta,
        goals,
        projects,
        graphEdges: nextEdges,
      }
      persistState(nextState)
      set(nextState)
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
  })
})
