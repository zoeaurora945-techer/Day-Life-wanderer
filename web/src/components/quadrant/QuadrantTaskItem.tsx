/**
 * @file QuadrantTaskItem component.
 * @description Compact task row used inside a quadrant cell, draggable and clickable for editing.
 */

import type { DragEvent, FC, MouseEvent } from 'react'
import { useRef } from 'react'
import type { Quadrant, Task } from '../../types/task'

/**
 * @description Props for QuadrantTaskItem.
 */
export interface QuadrantTaskItemProps {
  task: Task
  onToggleDone: (taskId: string) => void
  /**
   * @description Optional edit handler, invoked when the row is clicked (except checkbox).
   */
  onEdit?: (task: Task) => void
  /**
   * @description Optional delete handler, used when user drags the row far to the left (swipe-to-delete).
   */
  onDelete?: (taskId: string) => void
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
 * @description Small task item with checkbox and minimal fields for quadrant display.
 * Supports:
 * - drag start to move between quadrants
 * - drag end with strong left horizontal movement to delete (swipe-to-delete)
 * - click on the row (except checkbox) to open an editor (when onEdit is provided)
 */
export const QuadrantTaskItem: FC<QuadrantTaskItemProps> = ({
  task,
  onToggleDone,
  onEdit,
  onDelete,
  taskQuadrant,
  quadrantBg,
  quadrantBorder,
}) => {
  const due = new Date(task.dueAt)

  /**
   * @description Zero-pads a number to two digits.
   */
  const pad = (n: number): string => (n < 10 ? `0${n}` : `${n}`)

  const dueLabel = `${pad(due.getMonth() + 1)}-${pad(due.getDate())} ${pad(
    due.getHours(),
  )}:${pad(due.getMinutes())}`

  /**
   * @description Tracks drag start position to detect horizontal swipe-to-delete.
   */
  const dragStartPosRef = useRef<{ x: number; y: number } | null>(null)

  /**
   * @description Emits a drag start event with the task id encoded in dataTransfer
   * and records the starting pointer position.
   */
  const handleDragStart = (event: DragEvent<HTMLDivElement>): void => {
    if (!event.dataTransfer) return
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('application/x-quadrant-task-id', task.id)
    event.dataTransfer.setData('text/plain', task.id)
    dragStartPosRef.current = { x: event.clientX, y: event.clientY }
  }

  /**
   * @description On drag end, if the movement is a strong left swipe, trigger delete.
   * To avoid误删移动到其他象限的操作，仅当:
   * - 水平方向向左移动超过 ~60px，且
   * - |dx| 明显大于 |dy|
   * 时才视为「滑动删除」。
   */
  const handleDragEnd = (event: DragEvent<HTMLDivElement>): void => {
    const start = dragStartPosRef.current
    dragStartPosRef.current = null
    if (!start || !onDelete) return

    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    const absDx = Math.abs(dx)
    const absDy = Math.abs(dy)

    if (dx < -60 && absDx > absDy * 1.5) {
      onDelete(task.id)
    }
  }

  /**
   * @description Handles click on the whole row (except checkbox) to trigger editing.
   */
  const handleClickRow = (event: MouseEvent<HTMLDivElement>): void => {
    // 阻止冒泡到 QuadrantCell，避免触发「新建任务」
    event.stopPropagation()
    if (onEdit) {
      onEdit(task)
    }
  }

  /**
   * @description Handles checkbox clicks: toggles done state without opening editor or creating tasks.
   */
  const handleClickCheckbox = (event: MouseEvent<HTMLInputElement>): void => {
    // 阻止触发行级点击和象限点击
    event.stopPropagation()
    onToggleDone(task.id)
  }

  return (
    <div
      className={`flex cursor-pointer items-center justify-between rounded-md px-2 py-1 text-xs shadow-sm ${
        taskQuadrant && quadrantBg?.[taskQuadrant]
          ? quadrantBg[taskQuadrant]
          : 'bg-white/80'
      } ${taskQuadrant && quadrantBorder?.[taskQuadrant]
          ? quadrantBorder[taskQuadrant]
          : 'border-transparent'
        } border`}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={handleClickRow}
    >
      <div className="flex flex-1 items-center gap-2">
        <input
          type="checkbox"
          checked={task.status === 'done'}
          onClick={handleClickCheckbox}
          className="h-3 w-3 rounded border-slate-400"
          readOnly
          aria-label={task.status === 'done' ? 'Mark as todo' : 'Mark as done'}
        />
        <span className="line-clamp-1 text-[11px] font-medium text-slate-800">
          {task.title}
        </span>
      </div>
      <span className="ml-2 whitespace-nowrap text-[10px] text-slate-500">
        {dueLabel}
      </span>
    </div>
  )
}
