/**
 * @file OverallGoalPanel component.
 * @description Overall (Tab4) view for high-level progress:
 * - Goals overview
 * - Projects overview (with optional start/end dates)
 * - Graph-style linking between projects and goals
 * - Obsidian-like relationship graph (goals + projects only)
 */

import type { FC } from 'react'
import { useMemo, useState } from 'react'
import type { GraphEdge, Goal, Task } from '../../types/task'
import { useTaskStore } from '../../store/useTaskStore'
import { GoalRelationsGraph } from './GoalRelationsGraph'

/**
 * @description Computes tasks connected to a specific goal via Task->Goal edges.
 * @param tasks - All tasks.
 * @param edges - All graph edges.
 * @param goalId - Target goal id.
 */
function getTasksForGoal(tasks: Task[], edges: GraphEdge[], goalId: string): Task[] {
  const taskIds = new Set(
    edges
      .filter(
        (e) =>
          e.toType === 'goal' &&
          e.toId === goalId &&
          e.fromType === 'task',
      )
      .map((e) => e.fromId),
  )
  return tasks.filter((t) => taskIds.has(t.id))
}

/**
 * @description Returns overall progress for all linked tasks across all goals.
 * 仍然基于 task->goal 边，方便你观察「实际完成度」。
 */
function getOverallProgress(tasks: Task[], edges: GraphEdge[]): number | null {
  const linkedTaskIds = new Set(
    edges
      .filter((e) => e.fromType === 'task' && e.toType === 'goal')
      .map((e) => e.fromId),
  )
  const linkedTasks = tasks.filter((t) => linkedTaskIds.has(t.id))
  if (linkedTasks.length === 0) return null
  const done = linkedTasks.filter((t) => t.status === 'done').length
  return done / linkedTasks.length
}

/**
 * @description Simple horizontal progress bar used in goal/project overview.
 */
const ProgressBar: FC<{ fraction: number | null; label: string }> = ({ fraction, label }) => {
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
 * @description Overall goal & project graph and linking UI for Tab4.
 * - Goals 模块：任务完成度视角
 * - Projects 模块：项目列表 + 起止日期
 * - Graph 模块：Project↔Goal 关系及关系图
 */
export const OverallGoalPanel: FC = () => {
  const {
    tasks,
    goals,
    projects,
    graphEdges,
    addGoal,
    deleteGoal,
    addProject,
    updateProject,
    deleteProject,
    addGraphEdge,
    deleteGraphEdge,
  } = useTaskStore()

  const [newGoalTitle, setNewGoalTitle] = useState('')
  const [newProjectTitle, setNewProjectTitle] = useState('')
  const [newProjectGoalId, setNewProjectGoalId] = useState<string>('none')
  const [newProjectStartDate, setNewProjectStartDate] = useState('')
  const [newProjectEndDate, setNewProjectEndDate] = useState('')

  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [selectedGoalId, setSelectedGoalId] = useState('')
  const [relation, setRelation] =
    useState<GraphEdge['relation']>('supports')

  const overallProgress = useMemo(
    () => getOverallProgress(tasks, graphEdges),
    [tasks, graphEdges],
  )

  const handleAddGoal = () => {
    const title = newGoalTitle.trim()
    if (!title) return
    addGoal({ title })
    setNewGoalTitle('')
  }

  const handleAddProject = () => {
    const title = newProjectTitle.trim()
    if (!title) return
    const goalId = newProjectGoalId === 'none' ? null : newProjectGoalId
    addProject({
      title,
      goalId,
      status: 'active',
      startDate: newProjectStartDate || undefined,
      endDate: newProjectEndDate || undefined,
    })
    setNewProjectTitle('')
    setNewProjectGoalId('none')
    setNewProjectStartDate('')
    setNewProjectEndDate('')
  }

  const handleCreateLink = () => {
    if (!selectedProjectId || !selectedGoalId) return
    addGraphEdge({
      fromType: 'project',
      fromId: selectedProjectId,
      toType: 'goal',
      toId: selectedGoalId,
      relation,
    })
  }

  const projectOptions = useMemo(
    () =>
      [...projects].sort((a, b) =>
        a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0,
      ),
    [projects],
  )

  const goalCards = useMemo(
    () =>
      goals.map((goal) => {
        const goalTasks = getTasksForGoal(tasks, graphEdges, goal.id)
        const total = goalTasks.length
        const done = goalTasks.filter((t) => t.status === 'done').length
        const fraction = total === 0 ? null : done / total
        return { goal, goalTasks, total, done, fraction }
      }),
    [goals, tasks, graphEdges],
  )

  const projectCards = useMemo(
    () =>
      projects.map((project) => {
        const parentGoal =
          project.goalId != null
            ? goals.find((g) => g.id === project.goalId) ?? null
            : null

        const linkedTaskCount = graphEdges.filter(
          (e) =>
            (e.fromType === 'project' &&
              e.fromId === project.id &&
              e.toType === 'task') ||
            (e.toType === 'project' &&
              e.toId === project.id &&
              e.fromType === 'task'),
        ).length

        const effectiveStatus = project.status ?? 'active'

        return {
          project,
          parentGoal,
          linkedTaskCount,
          effectiveStatus,
        }
      }),
    [projects, goals, graphEdges],
  )

  const linkEntries = useMemo(
    () =>
      graphEdges
        .filter(
          (e) =>
            (e.fromType === 'project' && e.toType === 'goal') ||
            (e.fromType === 'goal' && e.toType === 'project'),
        )
        .map((e) => {
          const projectId = e.fromType === 'project' ? e.fromId : e.toId
          const goalId = e.fromType === 'goal' ? e.fromId : e.toId
          const project = projects.find((p) => p.id === projectId)
          const goal = goals.find((g) => g.id === goalId)
          return { edge: e, project, goal }
        })
        .filter((x) => x.project && x.goal),
    [graphEdges, projects, goals],
  )

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white/90 p-4 shadow-sm">
      <header className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">
          Overall · Goals, projects and graph
        </h2>
        <span className="text-xs text-slate-500">
          Link projects to goals, and tasks to projects, to see life progress.
        </span>
      </header>

      <div className="space-y-2">
        <ProgressBar fraction={overallProgress} label="All linked tasks overall" />
      </div>

      {/* GOALS */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <h3 className="mb-2 text-xs font-semibold uppercase text-slate-600">
          Add goal
        </h3>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            className="flex-1 rounded-md border border-slate-300 px-2 py-1 text-sm"
            placeholder="E.g. Finish PhD, Learn dancing..."
            value={newGoalTitle}
            onChange={(e) => setNewGoalTitle(e.target.value)}
          />
          <button
            type="button"
            onClick={handleAddGoal}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
          >
            Create goal
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase text-slate-700">
          Goals · progress (by tasks)
        </h3>
        {goalCards.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-200 px-3 py-2 text-xs text-slate-500">
            No goals yet. Create one above and start linking tasks via other panels.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {goalCards.map(({ goal, goalTasks, total, done, fraction }) => (
              <div
                key={goal.id}
                className="flex flex-col rounded-lg border border-slate-200 bg-white p-3"
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <div>
                    <h4 className="line-clamp-1 text-sm font-semibold text-slate-900">
                      {goal.title}
                    </h4>
                    {goal.notes ? (
                      <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-500">
                        {goal.notes}
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteGoal(goal.id)}
                    className="text-[11px] text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                </div>
                <ProgressBar
                  fraction={fraction}
                  label={
                    total === 0
                      ? 'No linked tasks'
                      : `Done ${done} / ${total} tasks`
                  }
                />
                {goalTasks.length > 0 ? (
                  <div className="mt-2 space-y-1">
                    <p className="text-[11px] font-medium text-slate-600">
                      Linked tasks
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {goalTasks.map((t) => (
                        <span
                          key={t.id}
                          className={`inline-flex items-center rounded-full px-2 py-[2px] text-[11px] ${
                            t.status === 'done'
                              ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                              : 'border border-slate-200 bg-slate-100 text-slate-800'
                          }`}
                        >
                          {t.title}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* PROJECTS */}
      <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
        <h3 className="text-xs font-semibold uppercase text-emerald-800">
          Projects · overview
        </h3>

        {/* Add project */}
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <input
            className="flex-1 rounded-md border border-emerald-300 bg-white px-2 py-1 text-sm"
            placeholder="E.g. Job hunt pipeline, Thesis writing, Skill stack..."
            value={newProjectTitle}
            onChange={(e) => setNewProjectTitle(e.target.value)}
          />
          <select
            className="rounded-md border border-emerald-300 bg-white px-2 py-1 text-xs"
            value={newProjectGoalId}
            onChange={(e) => setNewProjectGoalId(e.target.value)}
          >
            <option value="none">No parent goal</option>
            {goals.map((g) => (
              <option key={g.id} value={g.id}>
                Attach to: {g.title}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-2 grid gap-2 md:grid-cols-[repeat(3,minmax(0,1fr))]">
          <div className="space-y-1">
            <label className="block text-[11px] font-medium text-emerald-800">
              Start date
            </label>
            <input
              type="date"
              className="w-full rounded-md border border-emerald-300 bg-white px-2 py-1 text-xs"
              value={newProjectStartDate}
              onChange={(e) => setNewProjectStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="block text-[11px] font-medium text-emerald-800">
              End date
            </label>
            <input
              type="date"
              className="w-full rounded-md border border-emerald-300 bg-white px-2 py-1 text-xs"
              value={newProjectEndDate}
              onChange={(e) => setNewProjectEndDate(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={handleAddProject}
              className="w-full rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800"
            >
              Create project
            </button>
          </div>
        </div>

        {/* Project list */}
        {projectCards.length === 0 ? (
          <div className="mt-2 rounded-md border border-dashed border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-800">
            No projects yet. Create a project to bridge big goals and concrete tasks.
          </div>
        ) : (
          <div className="mt-2 grid gap-3 md:grid-cols-2">
            {projectCards.map(
              ({ project, parentGoal, linkedTaskCount, effectiveStatus }) => {
                const isCompleted = effectiveStatus === 'completed'

                return (
                  <div
                    key={project.id}
                    className={`flex flex-col rounded-lg p-3 ${
                      isCompleted
                        ? 'border border-slate-300 bg-slate-100 opacity-80'
                        : 'border border-emerald-200 bg-white'
                    }`}
                  >
                    <div className="mb-1 flex items-start justify-between gap-2">
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {parentGoal ? (
                            <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2 py-[1px] text-[10px] font-medium text-sky-800">
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
                        <h4
                          className={`line-clamp-1 text-sm font-semibold ${
                            isCompleted
                              ? 'text-slate-500 line-through'
                              : 'text-slate-900'
                          }`}
                        >
                          {project.title}
                        </h4>
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteProject(project.id)}
                        className="shrink-0 text-[11px] text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    </div>

                    <div className="mt-1 flex items-center justify-between gap-2 text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-[1px] text-[10px] text-emerald-700">
                          {linkedTaskCount} linked tasks
                        </span>
                        <span
                          className={`rounded-full px-1.5 py-[1px] text-[10px] ${
                            effectiveStatus === 'completed'
                              ? 'border border-emerald-300 bg-emerald-50 text-emerald-700'
                              : effectiveStatus === 'paused'
                                ? 'border border-amber-300 bg-amber-50 text-amber-700'
                                : 'border border-sky-300 bg-sky-50 text-sky-700'
                          }`}
                        >
                          {effectiveStatus === 'completed'
                            ? 'Completed'
                            : effectiveStatus === 'paused'
                              ? 'Paused'
                              : 'Active'}
                        </span>
                      </div>
                      <select
                        className="rounded-md border border-slate-300 px-1.5 py-[2px] text-[10px]"
                        value={effectiveStatus}
                        onChange={(e) =>
                          updateProject(project.id, {
                            status: e.target.value as
                              | 'active'
                              | 'paused'
                              | 'completed',
                          })
                        }
                      >
                        <option value="active">Active</option>
                        <option value="paused">Paused</option>
                        <option value="completed">Completed</option>
                      </select>
                    </div>
                  </div>
                )
              },
            )}
          </div>
        )}
      </div>

      {/* GRAPH: link project to goal */}
      <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <h3 className="text-xs font-semibold uppercase text-slate-600">
          Graph · link project to goal
        </h3>
        <div className="grid gap-2 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.3fr)_minmax(0,0.8fr)_auto]">
          <select
            className="rounded-md border border-slate-300 px-2 py-1 text-xs"
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
          >
            <option value="">Select project…</option>
            {projectOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
          <select
            className="rounded-md border border-slate-300 px-2 py-1 text-xs"
            value={selectedGoalId}
            onChange={(e) => setSelectedGoalId(e.target.value)}
          >
            <option value="">Select goal…</option>
            {goals.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </select>
          <select
            className="rounded-md border border-slate-300 px-2 py-1 text-xs"
            value={relation}
            onChange={(e) =>
              setRelation(e.target.value as GraphEdge['relation'])
            }
          >
            <option value="supports">supports</option>
            <option value="depends_on">depends_on</option>
            <option value="custom">custom</option>
          </select>
          <button
            type="button"
            onClick={handleCreateLink}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
          >
            Create link
          </button>
        </div>

        <div className="mt-2 space-y-1">
          <p className="text-[11px] font-medium text-slate-600">
            Existing links (project ↔ goal)
          </p>
          {linkEntries.length === 0 ? (
            <div className="rounded-md border border-dashed border-slate-200 px-2 py-1 text-[11px] text-slate-500">
              No links yet.
            </div>
          ) : (
            <div className="max-h-40 space-y-1 overflow-auto">
              {linkEntries.map(({ edge, project, goal }) => (
                <div
                  key={edge.id}
                  className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px]"
                >
                  <span className="truncate">
                    <span className="font-semibold text-slate-800">
                      {project!.title}
                    </span>{' '}
                    <span className="text-slate-500">({edge.relation})</span>{' '}
                    <span className="font-semibold text-slate-800">
                      {goal!.title}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => deleteGraphEdge(edge.id)}
                    className="ml-2 text-[11px] text-red-600 hover:underline"
                  >
                    Unlink
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Relationship graph at the very bottom (Goals + Projects) */}
      <div className="space-y-2 rounded-lg border border-slate-900 bg-slate-950 p-3">
        <h3 className="text-xs font-semibold uppercase text-slate-200">
          Relationship graph
        </h3>
        <p className="text-[11px] text-slate-400">
          Each dot is a goal or a project. Lines show project→goal relationships; hover to highlight neighbors.
        </p>
        <GoalRelationsGraph
          goals={goals}
          projects={projects}
          graphEdges={graphEdges}
          onNodeClick={({ type, id }) => {
            if (type === 'project') {
              setSelectedProjectId(id)
            } else {
              setSelectedGoalId(id)
            }
          }}
        />
      </div>
    </section>
  )
}
