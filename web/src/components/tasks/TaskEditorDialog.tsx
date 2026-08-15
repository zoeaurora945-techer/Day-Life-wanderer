/**
 * @file TaskEditorDialog component.
 * @description Simple modal dialog for creating or editing a task, now with optional project selection.
 */

import type { FC, FormEvent } from 'react'
import { useEffect, useRef, useState } from 'react'
import type { Category, Importance, Task, UrgentMode } from '../../types/task'
import { DateTimePicker } from './DateTimePicker'
import { useTaskStore } from '../../store/useTaskStore'

/**
 * @description Data used to initialise the form when opening.
 */
export interface TaskFormInitial {
  title?: string
  importance?: Importance
  category?: Category
  dueAt?: string
  notes?: string
}

/**
 * @description Props for TaskEditorDialog.
 */
export interface TaskEditorDialogProps {
  open: boolean
  mode: 'create' | 'edit'
  now: Date
  task?: Task | null
  initialHint?: TaskFormInitial
  onClose: () => void
  onSubmitCreate: (payload: {
    title: string
    importance: Importance
    category: Category
    dueAt: string
    notes?: string
    urgentMode: UrgentMode
    urgentManual?: boolean
  }) => void
  onSubmitUpdate: (id: string, patch: Partial<Task>) => void
}

/**
 * @description Returns the primary project id for a given task based on task↔project edges.
 * If multiple edges exist, the first matching project id is returned.
 */
function getProjectIdForTask(
  edges: ReturnType<typeof useTaskStore>['graphEdges'],
  taskId: string,
): string | null {
  const edge = edges.find(
    (e) =>
      (e.fromType === 'task' &&
        e.fromId === taskId &&
        e.toType === 'project') ||
      (e.toType === 'task' && e.toId === taskId && e.fromType === 'project'),
  )
  if (!edge) return null
  if (edge.fromType === 'project') return edge.fromId
  if (edge.toType === 'project') return edge.toId
  return null
}

/**
 * @description Centered overlay dialog wrapping a basic task form with project selection.
 * - The form is initialised when dialog打开时或用户尚未编辑且外部任务发生变化。
 * - 一旦用户修改过任意字段，就不会因为外部 props（如 initialHint、graphEdges、now）变化而重置已输入内容。
 */
export const TaskEditorDialog: FC<TaskEditorDialogProps> = ({
  open,
  mode,
  now,
  task,
  initialHint,
  onClose,
  onSubmitCreate,
  onSubmitUpdate,
}) => {
  const { projects, graphEdges, setTaskProject } = useTaskStore()

  const [title, setTitle] = useState('')
  const [importance, setImportance] = useState<Importance>('important')
  const [category, setCategory] = useState<Category>('work')
  /**
   * @description Due time as ISO string; kept in 10-minute granularity by DateTimePicker.
   */
  const [dueIso, setDueIso] = useState('')
  const [notes, setNotes] = useState('')
  const [urgentMode, setUrgentMode] = useState<UrgentMode>('auto')
  const [urgentManual, setUrgentManual] = useState<boolean>(false)
  /**
   * @description Currently selected project id in the dialog; 'none' means no project.
   */
  const [selectedProjectId, setSelectedProjectId] = useState<string>('none')

  /**
   * @description Tracks previous open state to detect transitions closed → open.
   */
  const prevOpenRef = useRef<boolean>(open)

  /**
   * @description Tracks whether user has edited any field in this open session.
   * If true, external prop changes will NOT reset the form.
   */
  const hasUserChangedRef = useRef<boolean>(false)

  /**
   * @description Initialise form values from task/initialHint.
   */
  const initialiseForm = () => {
    if (mode === 'edit' && task) {
      setTitle(task.title)
      setImportance(task.importance)
      setCategory(task.category)
      setDueIso(task.dueAt)
      setNotes(task.notes ?? '')
      setUrgentMode(task.urgentMode)
      setUrgentManual(Boolean(task.urgentManual))

      const currentProjectId = getProjectIdForTask(graphEdges, task.id)
      setSelectedProjectId(currentProjectId ?? 'none')
    } else {
      setTitle(initialHint?.title ?? '')
      setImportance(initialHint?.importance ?? 'important')
      setCategory(initialHint?.category ?? 'work')
      if (initialHint?.dueAt) {
        setDueIso(initialHint.dueAt)
      } else {
        setDueIso(now.toISOString())
      }
      setNotes(initialHint?.notes ?? '')
      setUrgentMode('auto')
      setUrgentManual(false)
      setSelectedProjectId('none')
    }
  }

  /**
   * @description Initialise form when:
   * - dialog 从关闭变为打开（重置用户修改标记并填充分组）；或
   * - dialog 已打开但用户尚未修改任何字段，且外部传入的 task/initialHint/now/graphEdges 发生变化。
   *
   * 一旦 hasUserChangedRef.current 为 true，则不会再因为外部 props 变化而重置用户已经编辑的内容。
   */
  useEffect(() => {
    const wasOpen = prevOpenRef.current
    prevOpenRef.current = open

    if (!open) {
      return
    }

    const justOpened = !wasOpen && open
    if (justOpened) {
      hasUserChangedRef.current = false
      initialiseForm()
      return
    }

    if (hasUserChangedRef.current) {
      // 用户已经在本次打开里编辑过内容，避免重置表单。
      return
    }

    // dialog 已打开，但用户还没动过，此时可以响应外部任务/提示变化。
    initialiseForm()
  }, [open, mode, task, initialHint, now, graphEdges])

  if (!open) return null

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !dueIso) return

    const trimmedTitle = title.trim()
    const effectiveProjectId =
      selectedProjectId === 'none' ? null : selectedProjectId

    if (mode === 'create') {
      const payload = {
        title: trimmedTitle,
        importance,
        category,
        dueAt: dueIso,
        notes,
        urgentMode,
        urgentManual: urgentMode === 'manual' ? urgentManual : undefined,
      }

      // onSubmitCreate is typed as void, but caller may return the new task id.
      const maybeTaskId = onSubmitCreate(payload) as unknown as
        | string
        | undefined

      if (effectiveProjectId && typeof maybeTaskId === 'string') {
        setTaskProject(maybeTaskId, effectiveProjectId)
      }
    } else if (mode === 'edit' && task) {
      onSubmitUpdate(task.id, {
        title: trimmedTitle,
        importance,
        category,
        dueAt: dueIso,
        notes,
        urgentMode,
        urgentManual: urgentMode === 'manual' ? urgentManual : null,
      })

      // Always update task↔project relation on save.
      setTaskProject(task.id, effectiveProjectId)
    }

    hasUserChangedRef.current = false
    onClose()
  }

  const handleClose = () => {
    hasUserChangedRef.current = false
    onClose()
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40">
      <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-lg">
        <h2 className="mb-3 text-base font-semibold text-slate-900">
          {mode === 'create' ? 'New task' : 'Edit task'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-700">
              Title<span className="text-red-500">*</span>
            </label>
            <input
              className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
              value={title}
              onChange={(e) => {
                hasUserChangedRef.current = true
                setTitle(e.target.value)
              }}
              placeholder="What needs to be done?"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700">
                Category
              </label>
              <select
                className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                value={category}
                onChange={(e) => {
                  hasUserChangedRef.current = true
                  setCategory(e.target.value as Category)
                }}
              >
                <option value="research">Research</option>
                <option value="work">Work</option>
                <option value="life">Life</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700">
                Importance
              </label>
              <select
                className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                value={importance}
                onChange={(e) => {
                  hasUserChangedRef.current = true
                  setImportance(e.target.value as Importance)
                }}
              >
                <option value="important">Important</option>
                <option value="not_important">Not important</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-700">
              Project
            </label>
            <select
              className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
              value={selectedProjectId}
              onChange={(e) => {
                hasUserChangedRef.current = true
                setSelectedProjectId(e.target.value)
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

          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-700">
              Due time<span className="text-red-500">*</span>
            </label>
            <DateTimePicker
              value={dueIso}
              onChange={(value) => {
                hasUserChangedRef.current = true
                setDueIso(value)
              }}
            />
            <p className="mt-0.5 text-[10px] text-slate-500">
              Time uses 10-minute steps (00, 10, 20, 30, 40, 50).
            </p>
          </div>

          <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)] gap-3">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700">
                Urgent mode
              </label>
              <select
                className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                value={urgentMode}
                onChange={(e) => {
                  hasUserChangedRef.current = true
                  setUrgentMode(e.target.value as UrgentMode)
                }}
              >
                <option value="auto">Auto (by due date)</option>
                <option value="manual">Manual</option>
              </select>
            </div>
            {urgentMode === 'manual' ? (
              <div className="flex items-end">
                <label className="flex items-center gap-1 text-xs font-medium text-slate-700">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 rounded border-slate-400"
                    checked={urgentManual}
                    onChange={(e) => {
                      hasUserChangedRef.current = true
                      setUrgentManual(e.target.checked)
                    }}
                  />
                  <span>Mark as urgent</span>
                </label>
              </div>
            ) : null}
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-700">
              Notes
            </label>
            <textarea
              className="h-16 w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
              value={notes}
              onChange={(e) => {
                hasUserChangedRef.current = true
                setNotes(e.target.value)
              }}
              placeholder="Optional details..."
            />
          </div>

          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
            >
              {mode === 'create' ? 'Create' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
