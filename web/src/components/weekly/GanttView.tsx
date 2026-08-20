/**
 * @file GanttView component.
 * @description Weekly task Gantt chart — horizontal timeline with tasks as colored bars,
 * grouped by goal → project, with today marker and status colors.
 */
import { useMemo } from 'react'
import type { FC } from 'react'
import type { Goal, GraphEdge, Project, Task } from '../../types/task'
import { getWeekRangeForDate, formatDateKey } from '../../utils/dateUtils'
import { t } from '../../i18n/translations'

interface GanttViewProps {
  tasks: Task[]
  goals: Goal[]
  projects: Project[]
  graphEdges: GraphEdge[]
  now: Date
  lang: string
}

interface GanttTask {
  id: string
  title: string
  start: number  // day index within the 14-day window (0 = window start)
  span: number   // number of days the bar spans
  status: 'todo' | 'doing' | 'done'
  goalTitle: string
  projectTitle: string | null
  dueAt: string
}

/**
 * @description Compute the 14-day window starting from the Monday of this week.
 */
function getWindowRange(now: Date) {
  const { start } = getWeekRangeForDate(now)
  const windowStart = new Date(start)
  const windowEnd = new Date(windowStart)
  windowEnd.setDate(windowEnd.getDate() + 13) // 14 days total
  return { windowStart, windowEnd }
}

/**
 * @description Map a date to a day index within the window.
 */
function dayIndex(date: Date, windowStart: Date, windowEnd: Date): number {
  const startMs = windowStart.getTime()
  const endMs = windowEnd.getTime()
  const dMs = date.getTime()
  if (dMs < startMs) return 0
  if (dMs > endMs) return 13
  return Math.round((dMs - startMs) / (1000 * 60 * 60 * 24))
}

/**
 * @description Get status color for a task.
 */
function statusColor(status: string): string {
  switch (status) {
    case 'done': return 'bg-emerald-500'
    case 'doing': return 'bg-amber-500'
    default: return 'bg-sky-500'
  }
}

/**
 * @description Get status label.
 */
function statusLabel(status: string, lang: string): string {
  if (lang === 'zh') {
    switch (status) {
      case 'done': return '已完成'
      case 'doing': return '进行中'
      default: return '待办'
    }
  }
  switch (status) {
    case 'done': return 'Done'
    case 'doing': return 'In progress'
    default: return 'Todo'
  }
}

/**
 * @description Build the Gantt data model from tasks, goals, projects, edges.
 */
function buildGanttData(
  tasks: Task[],
  goals: Goal[],
  projects: Project[],
  graphEdges: GraphEdge[],
  now: Date,
): GanttTask[] {
  const { windowStart, windowEnd } = getWindowRange(now)
  const totalDays = 14

  // Build lookup maps
  const goalMap = new Map(goals.map((g) => [g.id, g]))
  const projectMap = new Map(projects.map((p) => [p.id, p]))
  // Map task -> project (bidirectional edges)
  const taskProjectMap = new Map<string, string>()
  for (const e of graphEdges) {
    if (e.fromType === 'task' && e.toType === 'project') {
      taskProjectMap.set(e.fromId, e.toId)
    } else if (e.toType === 'task' && e.fromType === 'project') {
      taskProjectMap.set(e.toId, e.fromId)
    }
  }

  const ganttTasks: GanttTask[] = []

  for (const task of tasks) {
    // Skip tasks far in the past (before window start)
    const dueDate = new Date(task.dueAt)
    if (dueDate < windowStart) continue
    // Skip tasks far in the future (after window end)
    if (dueDate > windowEnd) continue

    const startMs = windowStart.getTime()
    const dueMs = dueDate.getTime()
    // Task "start" is either its createdAt or the window start
    const createdAt = new Date(task.createdAt)
    const effectiveStart = createdAt > windowStart ? createdAt : windowStart

    const startIdx = dayIndex(effectiveStart, windowStart, windowEnd)
    const dueIdx = dayIndex(dueDate, windowStart, windowEnd)
    const span = Math.max(1, dueIdx - startIdx + 1)

    const projectId = taskProjectMap.get(task.id) ?? null
    const project = projectId ? projectMap.get(projectId) ?? null : null
    const goal = project?.goalId ? goalMap.get(project.goalId) ?? null : null

    ganttTasks.push({
      id: task.id,
      title: task.title,
      start: startIdx,
      span,
      status: task.status,
      goalTitle: goal?.title ?? '',
      projectTitle: project?.title ?? null,
      dueAt: task.dueAt,
    })
  }

  return ganttTasks
}

/**
 * @description Group Gantt tasks by goal, then by project.
 */
function groupByGoalProject(tasks: GanttTask[]): Map<string, Map<string, GanttTask[]>> {
  const goalMap = new Map<string, Map<string, GanttTask[]>>()

  for (const t of tasks) {
    const goalKey = t.goalTitle || 'ungrouped'
    const projectKey = t.projectTitle || 'ungrouped'
    if (!goalMap.has(goalKey)) {
      goalMap.set(goalKey, new Map())
    }
    const projectMap = goalMap.get(goalKey)!
    if (!projectMap.has(projectKey)) {
      projectMap.set(projectKey, [])
    }
    projectMap.get(projectKey)!.push(t)
  }

  return goalMap
}

/**
 * @description Single Gantt row for one task.
 */
const GanttRow: FC<{
  task: GanttTask
  colStart: number
  colSpan: number
  todayIndex: number
  lang: string
}> = ({ task, colStart, colSpan, todayIndex, lang }) => {
  const isOverdue = task.status === 'todo' && new Date(task.dueAt) < new Date()
  const barColor = isOverdue
    ? 'bg-rose-500'
    : statusColor(task.status)

  return (
    <div className="flex items-center gap-2 py-0.5">
      {/* Task title */}
      <div className="w-32 shrink-0 truncate text-[10px] text-slate-700" title={task.title}>
        {task.title}
      </div>
      {/* Bar track */}
      <div className="relative flex-1 h-4 bg-slate-100 rounded-full overflow-hidden">
        {/* Today line */}
        {todayIndex >= colStart && todayIndex < colStart + colSpan ? (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-rose-500 z-10"
            style={{ left: `${((todayIndex - colStart) / colSpan) * 100}%` }}
          />
        ) : todayIndex >= colStart + colSpan ? (
          <div className="absolute top-0 bottom-0 w-0.5 bg-rose-500 z-10 right-0" />
        ) : todayIndex < colStart ? (
          <div className="absolute top-0 bottom-0 w-0.5 bg-rose-500 z-10 left-0" />
        ) : null}
        {/* Task bar */}
        <div
          className={`absolute top-0.5 bottom-0.5 rounded-full ${barColor} opacity-80 hover:opacity-100 transition-opacity`}
          style={{
            left: `${(colStart / (colSpan * 14)) * 100}%`,
            width: `${(colSpan / 14) * 100}%`,
          }}
        />
      </div>
      {/* Status badge */}
      <span className={`text-[9px] font-medium ${isOverdue ? 'text-rose-600' : 'text-slate-500'}`}>
        {statusLabel(task.status, lang)}
      </span>
    </div>
  )
}

/**
 * @description Main GanttView component.
 */
export const GanttView: FC<GanttViewProps> = ({ tasks, goals, projects, graphEdges, now, lang }) => {
  const ganttTasks = useMemo(
    () => buildGanttData(tasks, goals, projects, graphEdges, now),
    [tasks, goals, projects, graphEdges, now],
  )

  const grouped = useMemo(
    () => groupByGoalProject(ganttTasks),
    [ganttTasks],
  )

  const { windowStart } = useMemo(() => getWindowRange(now), [now])
  const todayIndex = useMemo(
    () => dayIndex(now, windowStart, new Date(windowStart.getTime() + 13 * 24 * 60 * 60 * 1000)),
    [now, windowStart],
  )

  // Day labels (Mon, Tue, Wed...)
  const dayLabels = useMemo(() => {
    const labels: string[] = []
    const d = new Date(windowStart)
    for (let i = 0; i < 14; i++) {
      labels.push(d.toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { weekday: 'short' }))
      d.setDate(d.getDate() + 1)
    }
    return labels
  }, [windowStart, lang])

  if (ganttTasks.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white p-4 text-center">
        <p className="text-xs text-slate-400">{t(lang, 'week.gantt.no_tasks')}</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      {/* Header: legend */}
      <div className="mb-2 flex items-center gap-3 text-[10px] text-slate-500">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-sky-500" />
          {t(lang, 'week.gantt.todo')}
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          {t(lang, 'week.gantt.in_progress')}
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          {t(lang, 'week.gantt.completed')}
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-0.5 bg-rose-500" />
          {t(lang, 'week.gantt.today')}
        </span>
      </div>

      {/* Day header */}
      <div className="mb-1 flex items-center gap-2">
        <div className="w-32 shrink-0 text-[9px] text-slate-400" />
        <div className="relative flex-1 h-4">
          {dayLabels.map((label, i) => (
            <span
              key={i}
              className={`absolute text-[9px] ${i === todayIndex ? 'font-semibold text-rose-600' : 'text-slate-400'}`}
              style={{ left: `${(i / 14) * 100}%`, transform: 'translateX(-50%)' }}
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Task rows grouped by goal → project */}
      <div className="space-y-3">
        {Array.from(grouped.entries()).map(([goalTitle, projectMap]) => (
          <div key={goalTitle}>
            {/* Goal label */}
            <div className="mb-1 text-[10px] font-semibold text-slate-600">{goalTitle}</div>
            <div className="space-y-1">
              {Array.from(projectMap.entries()).map(([projectTitle, projectTasks]) => (
                <div key={projectTitle}>
                  {/* Project label */}
                  {projectTitle !== 'ungrouped' && (
                    <div className="ml-3 mb-0.5 text-[9px] text-slate-500">· {projectTitle}</div>
                  )}
                  {/* Task bars */}
                  {projectTasks.map((task) => (
                    <GanttRow
                      key={task.id}
                      task={task}
                      colStart={task.start}
                      colSpan={task.span}
                      todayIndex={todayIndex}
                      lang={lang}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
