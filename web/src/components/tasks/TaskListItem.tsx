/**
 * @file TaskListItem component.
 * @description Full-width task row for the aggregated task list view, styled by quadrant with basic meta info.
 */

import type { FC } from 'react'
import type { Quadrant, Task } from '../../types/task'
import { getCategoryCardClasses, getCategoryPillClasses } from '../../utils/categoryStyles'

/**
 * @description Props for TaskListItem.
 */
export interface TaskListItemProps {
  task: Task
  now: Date
  onToggleDone: (taskId: string) => void
  onEdit: (task: Task) => void
  onDelete: (taskId: string) => void
  /**
   * @description The quadrant this task belongs to for coloring.
   */
  taskQuadrant?: Quadrant
  /**
   * @description Background colors by quadrant.
   */
  quadrantBg?: Record<Quadrant, string>
  /**
   * @description Border colors by quadrant.
   */
  quadrantBorder?: Record<Quadrant, string>
}

/**
 * @description Quadrant colors for the list view.
 */
const QUADRANT_COLORS: Record<Quadrant, { bg: string; border: string }> = {
  Q1_IMPORTANT_URGENT: { bg: 'bg-rose-50', border: 'border-rose-200' },
  Q2_NOTIMPORTANT_URGENT: { bg: 'bg-amber-50', border: 'border-amber-200' },
  Q3_IMPORTANT_NOTURGENT: { bg: 'bg-sky-50', border: 'border-sky-200' },
  Q4_NOTIMPORTANT_NOTURGENT: { bg: 'bg-slate-50', border: 'border-slate-200' },
}

/**
 * @description Rich row showing a task with quadrant-based pastel color, category pill,
 * importance, due time and basic controls.
 */
export const TaskListItem: FC<TaskListItemProps> = ({
  task,
  now,
  onToggleDone,
  onEdit,
  onDelete,
  taskQuadrant,
  quadrantBg: customBg,
  quadrantBorder: customBorder,
}) => {
  // Use quadrant colors if available, fallback to category colors
  const bgColor = customBg?.[taskQuadrant ?? 'Q4_NOTIMPORTANT_NOTURGENT'] ?? ''
  const borderColor = customBorder?.[taskQuadrant ?? 'Q4_NOTIMPORTANT_NOTURGENT'] ?? 'border-slate-200'
  const cardAccent = getCategoryCardClasses(task.category)
  const pillAccent = getCategoryPillClasses(task.category)
  const isDone = task.status === 'done'

  const due = new Date(task.dueAt)
  const pad = (n: number): string => (n < 10 ? `0${n}` : `${n}`)
  const dueLabel = `${due.getFullYear()}-${pad(due.getMonth() + 1)}-${pad(
    due.getDate(),
  )} ${pad(due.getHours())}:${pad(due.getMinutes())}`

  const categoryLabel =
    task.category === 'research'
      ? 'Research'
      : task.category === 'work'
        ? 'Work'
        : 'Life'

  const importanceLabel =
    task.importance === 'important' ? 'Important' : 'Not important'

  return (
    <article
      className={`flex cursor-pointer items-start justify-between rounded-lg border px-3 py-2 text-xs shadow-sm ${borderColor} ${bgColor}`}
      onClick={() => onEdit(task)}
    >
      <div className="flex flex-1 items-start gap-2">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onToggleDone(task.id)
          }}
          className="mt-1 h-3.5 w-3.5 shrink-0 rounded border border-slate-400 bg-white"
          aria-label={isDone ? 'Mark as todo' : 'Mark as done'}
        >
          {isDone ? (
            <span className="block h-full w-full bg-slate-800" />
          ) : null}
        </button>

        <div className="min-w-0 flex-1 space-y-1">
          <p
            className={`truncate text-sm font-medium ${
              isDone ? 'text-slate-400 line-through' : 'text-slate-900'
            }`}
          >
            {task.title}
          </p>

          <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-600">
            <span
              className={`inline-flex items-center rounded-full border px-2 py-[1px] text-[10px] font-medium ${pillAccent}`}
            >
              {categoryLabel}
            </span>
            <span className="rounded-full bg-white/70 px-2 py-[1px]">
              {importanceLabel}
            </span>
            <span className="text-[10px] text-slate-500">{dueLabel}</span>
          </div>

          {task.notes ? (
            <p className="line-clamp-2 text-[11px] text-slate-600">
              {task.notes}
            </p>
          ) : null}
        </div>
      </div>

      <div className="ml-2 flex flex-col items-end gap-1">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onEdit(task)
          }}
          className="rounded-md border border-slate-300 bg-white px-2 py-[2px] text-[10px] text-slate-700 hover:bg-slate-50"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onDelete(task.id)
          }}
          className="rounded-md border border-red-300 bg-red-50 px-2 py-[2px] text-[10px] text-red-700 hover:bg-red-100"
        >
          Delete
        </button>
      </div>
    </article>
  )
}
