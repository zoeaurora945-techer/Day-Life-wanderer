/**
 * @file TaskListPanel component.
 * @description Aggregated task view, split into todo and done sections. Done tasks are grouped by completion time.
 */

import type { FC } from 'react'
import { useMemo } from 'react'
import type { Quadrant, Task } from '../../types/task'
import { getTaskQuadrant } from '../../utils/taskUtils'
import { TaskListItem } from './TaskListItem'
import { formatDateKey } from '../../utils/dateUtils'

/**
 * @description Props for TaskListPanel.
 */
export interface TaskListPanelProps {
  tasks: Task[]
  now: Date
  activeQuadrantFilter: Quadrant | null
  onClearQuadrantFilter: () => void
  onToggleDone: (taskId: string) => void
  onEditTask: (task: Task) => void
  onDeleteTask: (taskId: string) => void
}

/**
 * @description Single done-task group definition used for rendering grouped sections.
 */
interface DoneGroup {
  id: string
  label: string
  tasks: Task[]
}

/**
 * @description Returns a new Date truncated to local day start (00:00:00.000).
 * @param date - Source date.
 */
function startOfDayLocal(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

/**
 * @description Groups completed tasks by completion time granularity:
 * - Today
 * - This week (last 7 days excluding today)
 * - Current year by month (YYYY-MM)
 * - Previous years by year (YYYY)
 * Assumes input tasks are pre-sorted by doneAt descending.
 * @param tasks - Completed tasks to group.
 * @param now - Current time used for relative calculations.
 */
function groupDoneTasksByCompletion(tasks: Task[], now: Date): DoneGroup[] {
  const groups = new Map<string, DoneGroup>()
  const todayKey = formatDateKey(now)
  const todayStart = startOfDayLocal(now)
  const msPerDay = 24 * 60 * 60 * 1000
  const currentYear = now.getFullYear()

  for (const task of tasks) {
    const baseIso = task.doneAt ?? task.createdAt
    const doneDate = new Date(baseIso)
    const doneKey = formatDateKey(doneDate)
    const doneStart = startOfDayLocal(doneDate)
    const diffDays = Math.floor(
      (todayStart.getTime() - doneStart.getTime()) / msPerDay,
    )
    let groupId: string
    let label: string

    if (doneKey === todayKey) {
      groupId = 'today'
      label = 'Today'
    } else if (diffDays >= 1 && diffDays < 7) {
      groupId = 'this-week'
      label = 'This week'
    } else {
      const year = doneDate.getFullYear()
      const month = doneDate.getMonth() + 1

      if (year === currentYear) {
        const monthLabel = `${year}-${month < 10 ? `0${month}` : `${month}`}`
        groupId = `month-${monthLabel}`
        label = monthLabel
      } else {
        groupId = `year-${year}`
        label = `${year}`
      }
    }

    let group = groups.get(groupId)
    if (!group) {
      group = { id: groupId, label, tasks: [] }
      groups.set(groupId, group)
    }
    group.tasks.push(task)
  }

  return Array.from(groups.values())
}

/**
 * @description Panel listing all tasks, separated into todo and done with sorting and filters.
 * Done tasks are collapsible and grouped by completion time.
 */
export const TaskListPanel: FC<TaskListPanelProps> = ({
  tasks,
  now,
  activeQuadrantFilter,
  onClearQuadrantFilter,
  onToggleDone,
  onEditTask,
  onDeleteTask,
}) => {
  // Compute quadrant for each task
  const tasksWithQuadrant = useMemo(() => {
    return tasks.map((task) => ({
      task,
      quadrant: getTaskQuadrant(task, now),
    }))
  }, [tasks, now])

  const todoItems = tasksWithQuadrant
    .filter((tq) => tq.task.status === 'todo')
    .filter((tq) =>
      activeQuadrantFilter ? tq.quadrant === activeQuadrantFilter : true,
    )
    .sort((a, b) => {
      const ad = new Date(a.task.dueAt).getTime()
      const bd = new Date(b.task.dueAt).getTime()
      if (ad !== bd) return ad - bd
      const ac = new Date(a.task.createdAt).getTime()
      const bc = new Date(b.task.createdAt).getTime()
      return ac - bc
    })

  const doneItems = tasksWithQuadrant
    .filter((tq) => tq.task.status === 'done')
    .sort((a, b) => {
      const ad = a.task.doneAt ? new Date(a.task.doneAt).getTime() : 0
      const bd = b.task.doneAt ? new Date(b.task.doneAt).getTime() : 0
      return bd - ad
    })

  /**
   * @description Tracks whether the Done section is expanded.
   */
  const [showDone, setShowDone] = useState(false)

  /**
   * @description Precomputed groups for done tasks based on completion time.
   */
  const doneGroups = useMemo(
    () => groupDoneTasksByCompletion(doneItems.map((d) => d.task), now),
    [doneItems, now],
  )

  // Quadrant colors
  const quadrantBg: Record<Quadrant, string> = {
    Q1_IMPORTANT_URGENT: 'bg-rose-50',
    Q2_NOTIMPORTANT_URGENT: 'bg-amber-50',
    Q3_IMPORTANT_NOTURGENT: 'bg-sky-50',
    Q4_NOTIMPORTANT_NOTURGENT: 'bg-slate-50',
  }

  const quadrantBorder: Record<Quadrant, string> = {
    Q1_IMPORTANT_URGENT: 'border-rose-200',
    Q2_NOTIMPORTANT_URGENT: 'border-amber-200',
    Q3_IMPORTANT_NOTURGENT: 'border-sky-200',
    Q4_NOTIMPORTANT_NOTURGENT: 'border-slate-200',
  }

  return (
    <section className="flex h-full flex-col rounded-xl border border-slate-200 bg-[#faf8f5]/90 p-3 shadow-sm">
      <header className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-900">Tasks</span>
          {activeQuadrantFilter ? (
            <button
              type="button"
              onClick={onClearQuadrantFilter}
              className="rounded-full bg-slate-100 px-2 py-[2px] text-[10px] text-slate-700 hover:bg-slate-200"
            >
              Clear quadrant filter
            </button>
          ) : null}
        </div>
        <span className="text-xs text-slate-500">
          Todo {todoItems.length} · Done {doneItems.length}
        </span>
      </header>

      <div className="flex-1 space-y-3 overflow-auto">
        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase text-slate-500">
            Todo
          </h3>
          <div className="space-y-2">
            {todoItems.length === 0 ? (
              <div className="rounded-md border border-dashed border-slate-200 px-3 py-2 text-xs text-slate-500">
                No todo tasks. Add one from the header or any quadrant.
              </div>
            ) : (
              todoItems.map(({ task, quadrant }) => (
                <TaskListItem
                  key={task.id}
                  task={task}
                  now={now}
                  taskQuadrant={quadrant}
                  quadrantBg={quadrantBg}
                  quadrantBorder={quadrantBorder}
                  onToggleDone={onToggleDone}
                  onEdit={onEditTask}
                  onDelete={onDeleteTask}
                />
              ))
            )}
          </div>
        </div>

        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase text-slate-500">
            Done
          </h3>

          {doneItems.length === 0 ? (
            <div className="space-y-2">
              <div className="rounded-md border border-dashed border-slate-200 px-3 py-2 text-xs text-slate-500">
                No completed tasks yet.
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setShowDone((prev) => !prev)}
                className="flex w-full items-center justify-between rounded-md border border-slate-200 bg-slate-50/50 px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-100"
              >
                <span className="flex items-center gap-1">
                  <span>{showDone ? '▼' : '▶'}</span>
                  <span>Done tasks</span>
                </span>
                <span className="text-[10px] text-slate-500">
                  {doneItems.length}
                </span>
              </button>

              {showDone ? (
                <div className="space-y-3">
                  {doneGroups.map((group) => (
                    <div key={group.id} className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-slate-500">
                        <span className="font-semibold">{group.label}</span>
                        <span>{group.tasks.length}</span>
                      </div>
                      <div className="space-y-2">
                        {group.tasks.map((task) => {
                          const quadrant = getTaskQuadrant(task, now)
                          return (
                            <TaskListItem
                              key={task.id}
                              task={task}
                              now={now}
                              taskQuadrant={quadrant}
                              quadrantBg={quadrantBg}
                              quadrantBorder={quadrantBorder}
                              onToggleDone={onToggleDone}
                              onEdit={onEditTask}
                              onDelete={onDeleteTask}
                            />
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
