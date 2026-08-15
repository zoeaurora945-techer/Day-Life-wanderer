/**
 * @file WeekGoalPanel component.
 * @description Weekly (Tab3) project-focused panel showing this week's progress per project,
 * including the tasks linked to each project. Each project card highlights its parent goal.
 */

import type { FC } from 'react'
import { useMemo } from 'react'
import type { GraphEdge, Goal, Project, Task } from '../../types/task'
import { useTaskStore } from '../../store/useTaskStore'
import {
  formatDateKey,
  getWeekRangeForDate,
  isIsoWithinWeek,
} from '../../utils/dateUtils'

/**
 * @description Props for WeekGoalPanel.
 */
export interface WeekGoalPanelProps {
  now: Date
}

/**
 * @description Computes tasks connected to a specific project via Task->Project edges.
 * 支持两种方向的边：task->project 和 project->task。
 */
function getTasksForProject(
  tasks: Task[],
  edges: GraphEdge[],
  projectId: string,
): Task[] {
  const taskIds = new Set(
    edges
      .filter(
        (e) =>
          (e.fromType === 'task' &&
            e.toType === 'project' &&
            e.toId === projectId) ||
          (e.fromType === 'project' &&
            e.toType === 'task' &&
            e.fromId === projectId),
      )
      .map((e) =>
        e.fromType === 'task'
          ? e.fromId
          : e.toType === 'task'
            ? e.toId
            : '',
      )
      .filter(Boolean),
  )
  return tasks.filter((t) => taskIds.has(t.id))
}

/**
 * @description Returns the primary project id for a given task based on task↔project edges.
 * If multiple edges exist, the first matching project id is returned.
 */
function getProjectIdForTask(edges: GraphEdge[], taskId: string): string | null {
  const edge = edges.find(
    (e) =>
      (e.fromType === 'task' &&
        e.fromId === taskId &&
        e.toType === 'project') ||
      (e.toType === 'task' &&
        e.toId === taskId &&
        e.fromType === 'project'),
  )
  if (!edge) return null
  if (edge.fromType === 'project') return edge.fromId
  if (edge.toType === 'project') return edge.toId
  return null
}

/**
 * @description Simple horizontal progress bar for weekly progress.
 */
const ProgressBar: FC<{ fraction: number | null; label: string }> = ({
  fraction,
  label,
}) => {
  const pct = fraction === null ? 0 : Math.round(fraction * 100)
  const display = fraction === null ? '—' : `${pct}%`
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="text-xs text-slate-600">{display}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-slate-100">
        <div
          className="h-2 rounded-full bg-slate-800 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

/**
 * @description Week project progress view, using Goal / Project / Task data model.
 * 只展示「Project + Task」，并在每个 Project 前显式标出对应 Goal。
 */
export const WeekGoalPanel: FC<WeekGoalPanelProps> = ({ now }) => {
  const { tasks, goals, projects, graphEdges, setTaskProject } = useTaskStore()
  const { start, end } = getWeekRangeForDate(now)
  const weekStartKey = formatDateKey(start)
  const weekEndKey = formatDateKey(end)

  const tasksInWeek = useMemo(
    () =>
      tasks.filter((t) =>
        isIsoWithinWeek(t.dueAt, weekStartKey, weekEndKey),
      ),
    [tasks, weekStartKey, weekEndKey],
  )

  const weekOverallFraction = useMemo(() => {
    if (tasksInWeek.length === 0) return null
    const done = tasksInWeek.filter((t) => t.status === 'done').length
    return done / tasksInWeek.length
  }, [tasksInWeek])

  const projectWeekly = useMemo(
    () =>
      projects.map((project: Project) => {
        const projectWeekTasks = getTasksForProject(
          tasksInWeek,
          graphEdges,
          project.id,
        )
        const total = projectWeekTasks.length
        const done = projectWeekTasks.filter(
          (t) => t.status === 'done',
        ).length
        const fraction = total === 0 ? null : done / total

        const parentGoal: Goal | null =
          project.goalId != null
            ? goals.find((g) => g.id === project.goalId) ?? null
            : null

        return { project, parentGoal, projectWeekTasks, total, done, fraction }
      }),
    [projects, tasksInWeek, graphEdges, goals],
  )

  /**
   * @description Computes per-task current project mapping for this week,
   * used to edit task↔project relations during weekly review.
   */
  const taskProjectMapping = useMemo(
    () =>
      tasksInWeek.map((task) => ({
        task,
        projectId: getProjectIdForTask(graphEdges, task.id),
      })),
    [tasksInWeek, graphEdges],
  )

  const hasAnyProject = projects.length > 0
  const hasAnyTask = tasksInWeek.length > 0

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white/90 p-3 shadow-sm">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-xs font-semibold uppercase text-slate-600">
            This week · projects and tasks
          </h2>
          <p className="text-[11px] text-slate-500">
            {weekStartKey} ~ {weekEndKey}
          </p>
        </div>
        <span className="text-[11px] text-slate-500">
          Focus on tasks linked to projects; each project card highlights its goal.
        </span>
      </header>

      <ProgressBar fraction={weekOverallFraction} label="All tasks this week" />

      <div className="mt-2 space-y-2">
        <h3 className="text-xs font-semibold uppercase text-slate-600">
          Per-project progress this week
        </h3>

        {!hasAnyProject ? (
          <div className="rounded-md border border-dashed border-slate-200 px-3 py-2 text-xs text-slate-500">
            No projects yet. Go to Overall tab to create projects and attach
            tasks, then come back here to see weekly focus.
          </div>
        ) : !hasAnyTask ? (
          <div className="rounded-md border border-dashed border-slate-200 px-3 py-2 text-xs text-slate-500">
            No tasks due this week. Plan tasks under your projects to see weekly progress.
          </div>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {projectWeekly.map(
              ({ project, parentGoal, projectWeekTasks, total, done, fraction }) => (
                <div
                  key={project.id}
                  className="flex flex-col rounded-lg border border-slate-200 bg-slate-50 p-3"
                >
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {parentGoal ? (
                          <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2 py-[1px] text-[10px] font-semibold text-sky-800">
                            Goal: {parentGoal.title}
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-[1px] text-[10px] text-slate-600">
                            No parent goal
                          </span>
                        )}
                        {(project.startDate || project.endDate) && (
                          <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-[1px] text-[10px] text-slate-600">
                            {project.startDate ?? '—'} ~ {project.endDate ?? '—'}
                          </span>
                        )}
                      </div>
                      <h4 className="text-sm font-semibold text-slate-900 line-clamp-1">
                        {project.title}
                      </h4>
                    </div>
                    <span className="shrink-0 text-[11px] text-slate-500">
                      {total === 0 ? 'No tasks' : `${done}/${total} done`}
                    </span>
                  </div>

                  <ProgressBar
                    fraction={fraction}
                    label={
                      total === 0
                        ? 'No tasks linked this week'
                        : 'This week completion'
                    }
                  />

                  {projectWeekTasks.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {projectWeekTasks.map((t) => (
                        <span
                          key={t.id}
                          className={`inline-flex items-center rounded-full px-2 py-[2px] text-[11px] ${
                            t.status === 'done'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-800 border border-slate-200'
                          }`}
                        >
                          {t.title}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ),
            )}
          </div>
        )}
      </div>

      {/* Task ↔ Project mapping helper for this week */}
      {hasAnyTask && (
        <div className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-white p-3">
          <h3 className="text-xs font-semibold uppercase text-slate-600">
            Task–Project mapping (this week)
          </h3>
          <p className="text-[11px] text-slate-500">
            Use this list to quickly link or adjust which project each task belongs to.
            Changes here will update the project cards above.
          </p>

          <div className="mt-2 space-y-1 max-h-64 overflow-auto">
            {taskProjectMapping.map(({ task, projectId }) => (
              <div
                key={task.id}
                className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-slate-900">
                    {task.title}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-slate-500">Project</span>
                  <select
                    className="rounded-md border border-slate-300 bg-white px-2 py-0.5 text-[10px]"
                    value={projectId ?? 'none'}
                    onChange={(e) => {
                      const value = e.target.value
                      setTaskProject(task.id, value === 'none' ? null : value)
                    }}
                  >
                    <option value="none">No project</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}