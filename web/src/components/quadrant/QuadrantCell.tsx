/**
 * @file QuadrantCell component.
 * @description Single quadrant block containing a subset of todo tasks, supporting drag-and-drop and quick creation.
 */

import type { FC } from 'react'
import type { Task } from '../../types/task'
import { QuadrantTaskItem } from './QuadrantTaskItem'

/**
 * @description Props for QuadrantCell.
 */
export interface QuadrantCellProps {
  title: string
  description?: string
  colorClass: string
  tasks: Task[]
  maxVisible?: number
  onToggleDone: (taskId: string) => void
  onCreateInQuadrant: () => void
  onShowMore: () => void
  /**
   * @description Called when a task is dropped into this quadrant.
   */
  onDropTask: (taskId: string) => void
  /**
   * @description Optional edit handler for tasks; invoked when a task row is clicked.
   */
  onEditTask?: (task: Task) => void
}

/**
 * @description Visual cell for a single Eisenhower quadrant with limited visible tasks.
 * Supports:
 * - drop target for dragged tasks to move across quadrants
 * - click on empty area to quickly add a new task
 * - per-task drag-left gesture to delete (handled inside QuadrantTaskItem when onDelete is provided)
 */
export const QuadrantCell: FC<QuadrantCellProps> = ({
  title,
  description,
  colorClass,
  tasks,
  maxVisible = 5,
  onToggleDone,
  onCreateInQuadrant,
  onShowMore,
  onDropTask,
  onEditTask,
}) => {
  const visibleTasks = tasks.slice(0, maxVisible)
  const hiddenCount = tasks.length - visibleTasks.length

  return (
    <section
      className={`flex flex-col rounded-xl border border-slate-200 p-2 text-xs shadow-sm ${colorClass}`}
      onClick={onCreateInQuadrant}
      onDragOver={(event) => {
        // Allow dropping by preventing default.
        event.preventDefault()
      }}
      onDrop={(event) => {
        event.preventDefault()
        const taskId =
          event.dataTransfer.getData('application/x-quadrant-task-id') ||
          event.dataTransfer.getData('text/plain')
        if (taskId) {
          onDropTask(taskId)
        }
      }}
    >
      <div className="mb-1 flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-[11px] font-semibold text-slate-800">
            {title}
          </span>
          {description ? (
            <span className="text-[10px] text-slate-600">{description}</span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onCreateInQuadrant()
          }}
          className="rounded-full bg-white/80 px-2 py-[2px] text-[10px] font-medium text-slate-800 shadow hover:bg-white"
        >
          ＋
        </button>
      </div>
      <div className="flex-1 space-y-1 overflow-hidden">
        {visibleTasks.map((task) => (
          <QuadrantTaskItem
            key={task.id}
            task={task}
            onToggleDone={onToggleDone}
            onEdit={onEditTask}
          />
        ))}
        {visibleTasks.length === 0 ? (
          <div className="flex h-full items-center justify-center rounded-md border border-dashed border-slate-300/70 bg-white/40 px-2 py-1 text-[10px] text-slate-500">
            No tasks yet
          </div>
        ) : null}
      </div>
      {hiddenCount > 0 ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onShowMore()
          }}
          className="mt-1 w-full rounded-md bg-white/80 px-2 py-1 text-[10px] font-medium text-slate-700 hover:bg-white"
        >
          View more ({hiddenCount})
        </button>
      ) : null}
    </section>
  )
}
