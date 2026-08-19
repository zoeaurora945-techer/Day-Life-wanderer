/**
 * @file QuadrantBoard component.
 * @description 2x2 Eisenhower matrix board, the main daily interaction surface, with drag-to-delete support.
 */

import type { DragEvent, FC } from 'react'
import type { Quadrant, Task } from '../../types/task'
import { getTaskQuadrant } from '../../utils/taskUtils'
import { useTaskStore } from '../../store/useTaskStore'
import { QuadrantCell } from './QuadrantCell'
import { Trash2 } from 'lucide-react'

/**
 * @description Props for QuadrantBoard.
 */
export interface QuadrantBoardProps {
  tasks: Task[]
  now: Date
  onToggleDone: (taskId: string) => void
  onCreateInQuadrant: (quadrant: Quadrant) => void
  onFilterByQuadrant: (quadrant: Quadrant) => void
  /**
   * @description Optional edit handler for tasks clicked inside any quadrant.
   */
  onEditTask?: (task: Task) => void
}

/**
 * @description Main 2x2 quadrant board, mapping todo tasks to four colored cells.
 * Layout:
 * - Top-left:    Important & urgent          (Q1)
 * - Top-right:   Important & not urgent      (Q3)
 * - Bottom-left: Not important & urgent      (Q2)
 * - Bottom-right:Not important & not urgent  (Q4)
 *
 * Supports:
 * - drag & drop to move tasks between quadrants
 * - drag to top trash area to delete tasks
 * - swipe / drag left on a single task row to delete
 * - click on quadrant background to create a new task
 * - click on a task (when onEditTask is provided) to edit it
 *
 * Urgency rules:
 * - When a task's urgentMode = "auto", urgency is computed from dueAt and current time.
 *   Dragging will NOT force it into manual mode, so it will still auto-switch between
 *   urgent / not urgent as time passes.
 * - When urgentMode = "manual", dragging between quadrants can change urgentManual
 *   so you can lock a task as urgent / not urgent regardless of time.
 */
export const QuadrantBoard: FC<QuadrantBoardProps> = ({
  tasks,
  now,
  onToggleDone,
  onCreateInQuadrant,
  onFilterByQuadrant,
  onEditTask,
}) => {
  const todoTasks = tasks.filter((t) => t.status === 'todo')

  const grouped: Record<Quadrant, Task[]> = {
    Q1_IMPORTANT_URGENT: [],
    Q2_NOTIMPORTANT_URGENT: [],
    Q3_IMPORTANT_NOTURGENT: [],
    Q4_NOTIMPORTANT_NOTURGENT: [],
  }

  for (const task of todoTasks) {
    const quadrant = getTaskQuadrant(task, now)
    if (!quadrant) continue
    grouped[quadrant].push(task)
  }

  /**
   * @description Sorts tasks by due time, then by created time.
   */
  const byDueThenCreated = (a: Task, b: Task): number => {
    const ad = new Date(a.dueAt).getTime()
    const bd = new Date(b.dueAt).getTime()
    if (ad !== bd) return ad - bd
    const ac = new Date(a.createdAt).getTime()
    const bc = new Date(b.createdAt).getTime()
    return ac - bc
  }

  ;(Object.keys(grouped) as Quadrant[]).forEach((q) =>
    grouped[q].sort(byDueThenCreated),
  )

  const updateTask = useTaskStore((state) => state.updateTask)
  const deleteTask = useTaskStore((state) => state.deleteTask)

  /**
   * @description Moves a task into a target quadrant by updating importance
   * and (when in manual mode) its urgent flag.
   *
   * - For tasks with urgentMode = "auto": we KEEP auto mode and do NOT touch urgency.
   *   They will still switch urgent/non-urgent automatically based on dueAt and `now`.
   * - For tasks with urgentMode = "manual": we update urgentManual according to
   *   whether the target quadrant is urgent or not.
   */
  const handleMoveTaskToQuadrant = (taskId: string, quadrant: Quadrant) => {
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return

    const isImportant =
      quadrant === 'Q1_IMPORTANT_URGENT' ||
      quadrant === 'Q3_IMPORTANT_NOTURGENT'
    const isUrgent =
      quadrant === 'Q1_IMPORTANT_URGENT' ||
      quadrant === 'Q2_NOTIMPORTANT_URGENT'

    const patch: Partial<Task> = {
      importance: isImportant ? 'important' : 'not_important',
    }

    // Only override urgent flag when the task is already in manual mode.
    if (task.urgentMode === 'manual') {
      patch.urgentManual = isUrgent
    }

    updateTask(taskId, patch)
  }

  /**
   * @description Handle drop onto the top trash area to delete the task.
   */
  const handleDropToTrash = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault()
    event.stopPropagation()
    const taskId =
      event.dataTransfer.getData('application/x-quadrant-task-id') ||
      event.dataTransfer.getData('text/plain')
    if (taskId) {
      deleteTask(taskId)
    }
  }

  return (
    <section className="flex h-full flex-col gap-2">
      {/* Top trash drop zone */}
      <div
        className="flex justify-end"
        onDragOver={(event) => {
          // Allow dropping tasks here.
          event.preventDefault()
        }}
        onDrop={handleDropToTrash}
      >
        <div className="flex cursor-copy items-center gap-1 rounded-full border border-rose-300 bg-rose-50 px-2 py-1 text-[10px] font-medium text-rose-700 shadow-sm">
          <Trash2 className="h-3 w-3" aria-hidden="true" />
          <span>拖到这里删除任务</span>
        </div>
      </div>

      {/* Main 2x2 quadrant grid */}
      <div className="grid flex-1 grid-cols-2 grid-rows-2 gap-3">
        {/* Q1: Important & urgent (top-left) */}
        <QuadrantCell
          title="Important & urgent"
          description="Focus first"
          colorClass="bg-rose-50"
          tasks={grouped.Q1_IMPORTANT_URGENT}
          onToggleDone={onToggleDone}
          onCreateInQuadrant={() => onCreateInQuadrant('Q1_IMPORTANT_URGENT')}
          onShowMore={() => onFilterByQuadrant('Q1_IMPORTANT_URGENT')}
          onDropTask={(taskId) =>
            handleMoveTaskToQuadrant(taskId, 'Q1_IMPORTANT_URGENT')
          }
          onEditTask={onEditTask}
        />

        {/* Q3: Important & not urgent (top-right) */}
        <QuadrantCell
          title="Important & not urgent"
          description="Plan & protect time"
          colorClass="bg-sky-50"
          tasks={grouped.Q3_IMPORTANT_NOTURGENT}
          onToggleDone={onToggleDone}
          onCreateInQuadrant={() => onCreateInQuadrant('Q3_IMPORTANT_NOTURGENT')}
          onShowMore={() => onFilterByQuadrant('Q3_IMPORTANT_NOTURGENT')}
          onDropTask={(taskId) =>
            handleMoveTaskToQuadrant(taskId, 'Q3_IMPORTANT_NOTURGENT')
          }
          onEditTask={onEditTask}
        />

        {/* Q2: Not important & urgent (bottom-left) */}
        <QuadrantCell
          title="Not important & urgent"
          description="Delegate or timebox"
          colorClass="bg-amber-50"
          tasks={grouped.Q2_NOTIMPORTANT_URGENT}
          onToggleDone={onToggleDone}
          onCreateInQuadrant={() => onCreateInQuadrant('Q2_NOTIMPORTANT_URGENT')}
          onShowMore={() => onFilterByQuadrant('Q2_NOTIMPORTANT_URGENT')}
          onDropTask={(taskId) =>
            handleMoveTaskToQuadrant(taskId, 'Q2_NOTIMPORTANT_URGENT')
          }
          onEditTask={onEditTask}
        />

        {/* Q4: Not important & not urgent (bottom-right) */}
        <QuadrantCell
          title="Not important & not urgent"
          description="Reduce or batch"
          colorClass="bg-slate-50"
          tasks={grouped.Q4_NOTIMPORTANT_NOTURGENT}
          onToggleDone={onToggleDone}
          onCreateInQuadrant={() =>
            onCreateInQuadrant('Q4_NOTIMPORTANT_NOTURGENT')
          }
          onShowMore={() => onFilterByQuadrant('Q4_NOTIMPORTANT_NOTURGENT')}
          onDropTask={(taskId) =>
            handleMoveTaskToQuadrant(taskId, 'Q4_NOTIMPORTANT_NOTURGENT')
          }
          onEditTask={onEditTask}
        />
      </div>
    </section>
  )
}
