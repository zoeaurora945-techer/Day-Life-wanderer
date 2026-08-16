/**
 * @file OverallGoalPanel component.
 * @description Overall (Tab4) dashboard view — dual-column layout:
 *   LEFT  (scrollable): Goals, Projects, Links management
 *   RIGHT (fixed hero): Relationship graph + quick stats
 *
 * Design principles (Impeccable):
 * - Graph as visual hero — always in viewport, largest element
 * - Progressive disclosure — create forms collapsed by default
 * - Spatial rhythm — tight intra-group (8-12px), generous inter-group (24-32px)
 * - Visual hierarchy — size + weight + space combined (3 dimensions)
 */

import type { FC } from 'react'
import { useMemo, useState } from 'react'
import type { GraphEdge, Goal, Task } from '../../types/task'
import { useTaskStore } from '../../store/useTaskStore'
import { GoalRelationsGraph } from './GoalRelationsGraph'

/**
 * @description Computes tasks connected to a specific goal via Task->Goal edges.
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
 * @description Compact horizontal progress bar.
 */
const ProgressBar: FC<{ fraction: number | null; label: string }> = ({ fraction, label }) => {
  const pct = fraction === null ? 0 : Math.round(fraction * 100)
  const display = fraction === null ? '—' : `${pct}%`
  return (
    <div className="flex items-center gap-3">
      <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-600">{label}</span>
      <span className="w-8 text-right text-xs font-tabular text-slate-500">{display}</span>
      <div className="h-1.5 w-24 flex-shrink-0 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-slate-800 transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

/**
 * @description Collapsible section header with toggle arrow.
 */
const SectionHeader: FC<{
  title: string
  subtitle?: string
  color: 'sky' | 'emerald' | 'slate'
  expanded?: boolean
  onToggle?: () => void
}> = ({ title, subtitle, color, expanded = true, onToggle }) => {
  const colorMap = {
    sky: { text: 'text-sky-700', bg: 'bg-sky-50', border: 'border-sky-200', accent: 'text-sky-600' },
    emerald: { text: 'text-emerald-800', bg: 'bg-emerald-50/70', border: 'border-emerald-200', accent: 'text-emerald-700' },
    slate: { text: 'text-slate-700', bg: 'bg-slate-50', border: 'border-slate-200', accent: 'text-slate-600' },
  }
  const c = colorMap[color]

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex w-full items-center justify-between rounded-t-lg ${c.bg} px-3 py-2 text-left transition-colors hover:${c.bg}`}
    >
      <div>
        <h3 className={`text-xs font-semibold tracking-wide uppercase ${c.text}`}>{title}</h3>
        {subtitle ? <p className="mt-0.5 text-[11px] text-slate-500">{subtitle}</p> : null}
      </div>
      {onToggle ? (
        <svg className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${c.accent} ${!expanded ? '-rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      ) : null}
    </button>
  )
}

/**
 * @description Overall dashboard — Goals, Projects, Graph in a dual-column layout.
 *
 * Layout (desktop, >= 1024px):
 * ┌────────────────────────┬──────────────────┐
 * │  Top bar (full width)  │                  │
 * ├────────────────────────┤  RIGHT PANEL     │
 * │  LEFT (scrollable)     │  ┌────────────┐  │
 * │  · Add Goal            │  │  GRAPH      │  │
 * │  · Goal Cards (2-col)  │  │  (hero)     │  │
 * │  · Projects (compact)  │  ├────────────┤  │
 * │  · Links (compact)     │  │  Quick Stats│  │
 * │                        │  └────────────┘  │
 * └────────────────────────┴──────────────────┘
 *
 * Layout (mobile, < 1024px): Single column, graph first (order: -1).
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

  // Form states
  const [newGoalTitle, setNewGoalTitle] = useState('')
  const [newProjectTitle, setNewProjectTitle] = useState('')
  const [newProjectGoalId, setNewProjectGoalId] = useState<string>('none')
  const [showProjectDates, setShowProjectDates] = useState(false)
  const [newProjectStartDate, setNewProjectStartDate] = useState('')
  const [newProjectEndDate, setNewProjectEndDate] = useState('')

  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [selectedGoalId, setSelectedGoalId] = useState('')
  const [relation, setRelation] =
    useState<GraphEdge['relation']>('supports')

  // Section collapse states
  const [goalsExpanded, setGoalsExpanded] = useState(true)
  const [projectsExpanded, setProjectsExpanded] = useState(true)
  const [linksExpanded, setLinksExpanded] = useState(true)

  const overallProgress = useMemo(
    () => getOverallProgress(tasks, graphEdges),
    [tasks, graphEdges],
  )

  /* ---- Actions ---- */

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
    setShowProjectDates(false)
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

  /* ---- Derived data ---- */

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
        return { project, parentGoal, linkedTaskCount, effectiveStatus }
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

  /* ---- Render ---- */

  return (
    <section className="flex h-full flex-col gap-0 overflow-hidden rounded-xl border border-slate-200 bg-white/90 shadow-sm">
      {/* ===== TOP BAR: Title + Global Progress (compact single row) ===== */}
      <header className="flex flex-shrink-0 items-center gap-4 border-b border-slate-100 px-4 py-2.5">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-900">Overall</h2>
          <p className="text-[11px] text-slate-400">Goals · Projects · Life graph</p>
        </div>
        <div className="h-6 w-px bg-slate-200" />
        <ProgressBar fraction={overallProgress} label="All linked tasks" />
      </header>

      {/* ===== MAIN DASHBOARD GRID ===== */}
      <div className="flex min-h-0 flex-1 gap-0 lg:grid lg:grid-cols-[1fr_340px] lg:gap-0">

        {/* -------- LEFT PANEL: Management (scrollable) -------- */}
        <div className="flex min-h-0 flex-col overflow-y-auto overflow-x-hidden px-4 py-3 lg:max-w-none">
          <div className="flex flex-col gap-3">

            {/* --- ADD GOAL (compact inline) --- */}
            <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-2.5">
              <div className="flex items-center gap-2">
                <input
                  className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400/20"
                  placeholder="Add a life goal…"
                  value={newGoalTitle}
                  onChange={(e) => setNewGoalTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddGoal()}
                />
                <button
                  type="button"
                  onClick={handleAddGoal}
                  className="flex-shrink-0 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-slate-800 active:bg-slate-950"
                >
                  Add Goal
                </button>
              </div>
            </div>

            {/* --- GOALS SECTION (collapsible) --- */}
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <SectionHeader
                title="Goals"
                subtitle={`${goalCards.length} goal${goalCards.length !== 1 ? 's' : ''}`}
                color="sky"
                expanded={goalsExpanded}
                onToggle={() => setGoalsExpanded(!goalsExpanded)}
              />
              {goalsExpanded && (
                <div className="border-t border-sky-100 p-2.5">
                  {goalCards.length === 0 ? (
                    <div className="rounded-md border border-dashed border-slate-200 px-3 py-3 text-center text-[11px] text-slate-400">
                      No goals yet. Create one above to start mapping your life.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {goalCards.map(({ goal, goalTasks, total, done, fraction }) => (
                        <div
                          key={goal.id}
                          className="group/goal rounded-lg border border-slate-100 bg-white p-2.5 transition-colors hover:border-sky-200 hover:bg-sky-50/30"
                        >
                          <div className="mb-1.5 flex items-start justify-between gap-2">
                            <h4 className="min-w-0 line-clamp-1 text-xs font-semibold text-slate-800">
                              {goal.title}
                            </h4>
                            <button
                              type="button"
                              onClick={() => deleteGoal(goal.id)}
                              className="shrink-0 text-[10px] font-medium text-red-500 opacity-0 transition-opacity group-hover/goal:opacity-100 hover:text-red-600"
                            >
                              Delete
                            </button>
                          </div>
                          <ProgressBar
                            fraction={fraction}
                            label={
                              total === 0
                                ? 'No linked tasks'
                                : `${done}/${total} done`
                            }
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* --- PROJECTS SECTION (collapsible, compact form) --- */}
            <div className="overflow-hidden rounded-lg border border-emerald-200">
              <SectionHeader
                title="Projects"
                subtitle={`${projectCards.length} project${projectCards.length !== 1 ? 's' : ''}`}
                color="emerald"
                expanded={projectsExpanded}
                onToggle={() => setProjectsExpanded(!projectsExpanded)}
              />
              {projectsExpanded && (
                <div className="border-t border-emerald-100 p-2.5 space-y-2.5">
                  {/* Compact create form */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        className="min-w-0 flex-1 rounded-md border border-emerald-200 bg-white px-2.5 py-1.5 text-xs placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400/20"
                        placeholder="New project…"
                        value={newProjectTitle}
                        onChange={(e) => setNewProjectTitle(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddProject()}
                      />
                      <select
                        className="w-32 rounded-md border border-emerald-200 bg-white px-2 py-1.5 text-xs focus:border-emerald-400 focus:outline-none"
                        value={newProjectGoalId}
                        onChange={(e) => setNewProjectGoalId(e.target.value)}
                      >
                        <option value="none">No goal</option>
                        {goals.map((g) => (
                          <option key={g.id} value={g.id}>{g.title}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setShowProjectDates(!showProjectDates)}
                        className="flex-shrink-0 rounded-md border border-emerald-200 px-2 py-1.5 text-[10px] font-medium text-emerald-700 transition-colors hover:bg-emerald-50"
                        title="Toggle date fields"
                      >
                        Dates
                      </button>
                      <button
                        type="button"
                        onClick={handleAddProject}
                        className="flex-shrink-0 rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-800"
                      >
                        Add
                      </button>
                    </div>

                    {/* Expandable date fields */}
                    {showProjectDates && (
                      <div className="flex items-center gap-2 rounded-md bg-emerald-50/50 px-2 py-1.5 animate-in fade-in slide-in-from-top-1">
                        <div className="flex items-center gap-1">
                          <label className="text-[10px] font-medium text-emerald-700">Start</label>
                          <input
                            type="date"
                            className="h-6 rounded border border-emerald-200 bg-white px-1.5 text-[10px]"
                            value={newProjectStartDate}
                            onChange={(e) => setNewProjectStartDate(e.target.value)}
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <label className="text-[10px] font-medium text-emerald-700">End</label>
                          <input
                            type="date"
                            className="h-6 rounded border border-emerald-200 bg-white px-1.5 text-[10px]"
                            value={newProjectEndDate}
                            onChange={(e) => setNewProjectEndDate(e.target.value)}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Project cards */}
                  {projectCards.length === 0 ? (
                    <div className="rounded-md border border-dashed border-emerald-200 bg-emerald-50/30 px-3 py-3 text-center text-[11px] text-emerald-600">
                      No projects yet. Create one to bridge goals and daily tasks.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                      {projectCards.map(
                        ({ project, parentGoal, linkedTaskCount, effectiveStatus }) => {
                          const isCompleted = effectiveStatus === 'completed'
                          return (
                            <div
                              key={project.id}
                              className={`group/proj flex items-center gap-2 rounded-lg border p-2 transition-colors ${
                                isCompleted
                                  ? 'border-slate-200 bg-slate-50 opacity-70'
                                  : 'border-emerald-100 bg-white hover:border-emerald-200 hover:bg-emerald-50/20'
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  {parentGoal ? (
                                    <span className="inline-flex max-w-[80px] truncate rounded-full border border-sky-200 bg-sky-50 px-1.5 py-px text-[9px] font-medium text-sky-700">
                                      {parentGoal.title}
                                    </span>
                                  ) : null}
                                  <h4 className={`min-w-0 truncate text-xs font-semibold ${
                                    isCompleted ? 'text-slate-400 line-through' : 'text-slate-800'
                                  }`}>
                                    {project.title}
                                  </h4>
                                </div>
                                <div className="mt-0.5 flex items-center gap-1.5 text-[10px]">
                                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-1 py-px text-emerald-700">
                                    {linkedTaskCount} tasks
                                  </span>
                                  <select
                                    className="h-4 rounded border border-slate-200 bg-transparent px-1 py-0 text-[9px] focus:outline-none"
                                    value={effectiveStatus}
                                    onChange={(e) =>
                                      updateProject(project.id, {
                                        status: e.target.value as 'active' | 'paused' | 'completed',
                                      })
                                    }
                                  >
                                    <option value="active">Active</option>
                                    <option value="paused">Paused</option>
                                    <option value="completed">Done</option>
                                  </select>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => deleteProject(project.id)}
                                className="shrink-0 text-[10px] font-medium text-red-500 opacity-0 transition-opacity group-hover/proj:opacity-100"
                              >
                                Del
                              </button>
                            </div>
                          )
                        },
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* --- LINKS SECTION (compact) --- */}
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <SectionHeader
                title="Links"
                subtitle={`${linkEntries.length} connection${linkEntries.length !== 1 ? 's' : ''}`}
                color="slate"
                expanded={linksExpanded}
                onToggle={() => setLinksExpanded(!linksExpanded)}
              />
              {linksExpanded && (
                <div className="border-t border-slate-100 p-2.5 space-y-2">
                  {/* Compact link form */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <select
                      className="max-w-[120px] rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs"
                      value={selectedProjectId}
                      onChange={(e) => setSelectedProjectId(e.target.value)}
                    >
                      <option value="">Project…</option>
                      {projectOptions.map((p) => (
                        <option key={p.id} value={p.id}>{p.title}</option>
                      ))}
                    </select>
                    <span className="text-slate-300">&rarr;</span>
                    <select
                      className="max-w-[120px] rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs"
                      value={selectedGoalId}
                      onChange={(e) => setSelectedGoalId(e.target.value)}
                    >
                      <option value="">Goal…</option>
                      {goals.map((g) => (
                        <option key={g.id} value={g.id}>{g.title}</option>
                      ))}
                    </select>
                    <select
                      className="hidden rounded-md border border-slate-200 bg-white px-1.5 py-1.5 text-[10px] sm:block"
                      value={relation}
                      onChange={(e) =>
                        setRelation(e.target.value as GraphEdge['relation'])
                      }
                    >
                      <option value="supports">supports</option>
                      <option value="depends_on">depends_on</option>
                    </select>
                    <button
                      type="button"
                      onClick={handleCreateLink}
                      className="rounded-md bg-slate-900 px-2.5 py-1.5 text-[10px] font-medium text-white hover:bg-slate-800"
                    >
                      Link
                    </button>
                  </div>

                  {/* Existing links list */}
                  {linkEntries.length === 0 ? (
                    <div className="rounded-md border border-dashed border-slate-150 px-2 py-2 text-center text-[10px] text-slate-400">
                      No links yet. Connect projects to goals above.
                    </div>
                  ) : (
                    <div className="max-h-28 space-y-0.5 overflow-auto">
                      {linkEntries.map(({ edge, project, goal }) => (
                        <div
                          key={edge.id}
                          className="flex items-center justify-between rounded border border-slate-100 bg-slate-50/50 px-2 py-1 text-[10px]"
                        >
                          <span className="truncate">
                            <span className="font-medium text-slate-700">{project!.title}</span>
                            <span className="mx-1 text-slate-300">&middot;</span>
                            <span className="font-medium text-slate-700">{goal!.title}</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => deleteGraphEdge(edge.id)}
                            className="ml-2 shrink-0 font-medium text-red-500 hover:text-red-600"
                          >
                            Unlink
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>
          {/* Bottom padding for scroll breathing room */}
          <div className="h-8 flex-shrink-0" />
        </div>

        {/* -------- RIGHT PANEL: Hero Graph + Stats (fixed, desktop only) -------- */}
        <div className="hidden flex-col border-l border-slate-200 bg-slate-950 lg:flex">
          {/* Relationship Graph — HERO */}
          <div className="relative min-h-0 flex-1 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-slate-950 via-slate-950/80 to-transparent px-3 pt-2.5 pb-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-200">
                Life Graph
              </h3>
              <p className="mt-0.5 text-[10px] text-slate-500">
                Click nodes to quick-link &middot; Hover to inspect
              </p>
            </div>
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

          {/* Quick Stats Bar */}
          <div className="flex flex-shrink-0 items-center gap-0 border-t border-slate-800 bg-slate-900/50 px-3 py-2">
            <StatBadge label="Goals" value={goals.length} color="sky" />
            <div className="w-px h-4 bg-slate-700" />
            <StatBadge label="Projects" value={projects.length} color="emerald" />
            <div className="w-px h-4 bg-slate-700" />
            <StatBadge label="Links" value={linkEntries.length} color="slate" />
            <div className="flex-1" />
            <span className="text-[9px] text-slate-600">
              {tasks.filter(t => t.status === 'todo').length} open tasks
            </span>
          </div>
        </div>

      </div>
    </section>
  )
}

/** Tiny stat badge for the bottom bar. */
const StatBadge: FC<{ label: string; value: number; color: 'sky' | 'emerald' | 'slate' }> = ({
  label, value, color,
}) => {
  const colors = {
    sky: 'text-sky-300',
    emerald: 'text-emerald-300',
    slate: 'text-slate-300',
  }
  return (
    <div className="text-center">
      <div className={`text-sm font-semibold tabular-nums ${colors[color]}`}>{value}</div>
      <div className="text-[8px] text-slate-600 leading-none">{label}</div>
    </div>
  )
}
