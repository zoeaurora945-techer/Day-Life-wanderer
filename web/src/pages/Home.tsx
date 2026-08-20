/**
 * @file Home page.
 * @description Main application shell with 4 tabs: Quadrant, All tasks, Week, Overall (goal graph).
 */

import type { FC } from 'react'
import { useEffect, useMemo, useState } from 'react'
import type {
  Quadrant,
  Task,
  WeeklyReview,
  WeeklyReviewActionItem,
} from '../types/task'
import { useTaskStore } from '../store/useTaskStore'
import { HeaderBar } from '../components/layout/HeaderBar'
import { QuadrantBoard } from '../components/quadrant/QuadrantBoard'
import { TaskListPanel } from '../components/tasks/TaskListPanel'
import { TaskEditorDialog } from '../components/tasks/TaskEditorDialog'
import { WeeklyReviewPanel } from '../components/weekly/WeeklyReviewPanel'
import { GanttView } from '../components/weekly/GanttView'
import { OverallGoalPanel } from '../components/goals/OverallGoalPanel'
import { GalaxyView } from '../components/galaxy/GalaxyView'
import { ErrorBoundary } from '../components/common/ErrorBoundary'
import { t, type Language } from '../i18n/translations'

type TabKey = 'board' | 'week' | 'overall' | 'galaxy'
type BoardMode = 'quadrant' | 'list'

/**
 * @description Week view combining Gantt chart and weekly review.
 */
const WeekView: FC<{ now: Date; lang: Language }> = ({ now, lang }) => {
  const { tasks, goals, projects, graphEdges, weeklyReviews, upsertWeeklyReview, updateWeeklyReview, addNextAction, updateNextAction, deleteNextAction, markNextActionConverted } = useTaskStore()

  const handleCreateTaskFromAction = (payload: {
    review: WeeklyReview
    action: WeeklyReviewActionItem
  }) => {
    const baseTitle = payload.action.content.trim()
    if (!baseTitle) return
    const newTaskId = addTask({
      title: baseTitle,
      importance: 'important',
      category: 'work',
      status: 'todo',
      dueAt: new Date().toISOString(),
      notes: '',
      urgentMode: 'auto',
      urgentManual: null,
    })
    markNextActionConverted(payload.review.id, payload.action.id, newTaskId)
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <GanttView
        tasks={tasks}
        goals={goals}
        projects={projects}
        graphEdges={graphEdges}
        now={now}
        lang={lang}
      />
      <WeeklyReviewPanel
        now={now}
        tasks={tasks}
        onCreateTaskFromAction={handleCreateTaskFromAction}
      />
    </div>
  )
}

/**
 * @description Home page with tabbed layout and shared data store.
 */
const Home: FC = () => {
  const {
    tasks,
    addTask,
    updateTask,
    toggleTaskStatus,
    deleteTask,
    markNextActionConverted,
    initializeForToday,
    lang,
    setLang,
  } = useTaskStore()

  const [activeTab, setActiveTab] = useState<TabKey>('board')
  const [boardMode, setBoardMode] = useState<BoardMode>('quadrant')
  const [activeQuadrantFilter, setActiveQuadrantFilter] =
    useState<Quadrant | null>(null)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create')
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [dialogInitialDueAt, setDialogInitialDueAt] = useState<
    string | undefined
  >(undefined)
  const [dialogInitialImportance, setDialogInitialImportance] = useState<
    Task['importance'] | undefined
  >(undefined)

  // Track current time (update every minute for Today/Week header).
  const [now, setNow] = useState<Date>(() => new Date())

  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(new Date())
    }, 60_000)
    return () => window.clearInterval(id)
  }, [])

  // Apply daily rollover once per calendar day (store takes care of dedup).
  useEffect(() => {
    initializeForToday(new Date())
  }, [initializeForToday, now])

  /**
   * @description Opens create dialog, optionally with initial due time / importance.
   */
  const openCreateDialog = (initial?: {
    dueAt?: string
    importance?: Task['importance']
  }) => {
    setDialogMode('create')
    setEditingTask(null)
    setDialogInitialDueAt(initial?.dueAt)
    setDialogInitialImportance(initial?.importance)
    setDialogOpen(true)
  }

  /**
   * @description Opens edit dialog for the given task.
   */
  const openEditDialog = (task: Task) => {
    setDialogMode('edit')
    setEditingTask(task)
    setDialogOpen(true)
  }

  const handleCreateTaskGlobal = () => {
    openCreateDialog()
  }

  const handleCreateInQuadrant = (quadrant: Quadrant) => {
    const importance: Task['importance'] =
      quadrant === 'Q1_IMPORTANT_URGENT' ||
      quadrant === 'Q3_IMPORTANT_NOTURGENT'
        ? 'important'
        : 'not_important'
    openCreateDialog({ dueAt: now.toISOString(), importance })
  }

  const handleFilterByQuadrant = (quadrant: Quadrant) => {
    setActiveQuadrantFilter(quadrant)
    setActiveTab('list')
  }

  const handleClearQuadrantFilter = () => {
    setActiveQuadrantFilter(null)
  }

  const handleToggleDone = (taskId: string) => {
    toggleTaskStatus(taskId)
  }

  /**
   * @description Shared edit handler; used by both QuadrantBoard and TaskListPanel.
   */
  const handleEditTask = (task: Task) => {
    openEditDialog(task)
  }

  const handleDeleteTask = (taskId: string) => {
    deleteTask(taskId)
  }

  const handleDialogClose = () => {
    setDialogOpen(false)
  }

  const handleDialogSubmitCreate: React.ComponentProps<
    typeof TaskEditorDialog
  >['onSubmitCreate'] = (payload) => {
    return addTask({
      title: payload.title,
      importance: payload.importance,
      category: payload.category,
      status: 'todo',
      dueAt: payload.dueAt,
      notes: payload.notes,
      urgentMode: payload.urgentMode,
      urgentManual: payload.urgentManual ?? null,
    })
  }

  const handleDialogSubmitUpdate: React.ComponentProps<
    typeof TaskEditorDialog
  >['onSubmitUpdate'] = (id, patch) => {
    updateTask(id, patch)
  }

  const initialHint = useMemo(
    () => ({
      dueAt: dialogInitialDueAt ?? now.toISOString(),
      importance: dialogInitialImportance ?? 'important',
    }),
    [dialogInitialDueAt, dialogInitialImportance, now],
  )

  const handleCreateTaskFromAction = (payload: {
    review: WeeklyReview
    action: WeeklyReviewActionItem
  }) => {
    const baseTitle = payload.action.content.trim()
    if (!baseTitle) return
    const newTaskId = addTask({
      title: baseTitle,
      importance: 'important',
      category: 'work',
      status: 'todo',
      dueAt: new Date().toISOString(),
      notes: '',
      urgentMode: 'auto',
      urgentManual: null,
    })
    markNextActionConverted(payload.review.id, payload.action.id, newTaskId)
  }

  const tabButtonClass = (tab: TabKey) =>
    `inline-flex items-center px-4 py-2 text-base font-medium rounded-full border ${
      activeTab === tab
        ? 'border-slate-900 bg-slate-900 text-white'
        : 'border-transparent bg-slate-100 text-slate-700 hover:bg-slate-200'
    }`

  return (
    <div className="flex h-screen flex-col bg-slate-50">
      <HeaderBar now={now} onCreateTask={handleCreateTaskGlobal} />

      <nav className="flex items-center gap-2 border-b border-slate-200 bg-white px-6 py-3">
        <button
          type="button"
          className={tabButtonClass('board')}
          onClick={() => setActiveTab('board')}
        >
          {t(lang, 'tab.board')}
        </button>
        <button
          type="button"
          className={tabButtonClass('week')}
          onClick={() => setActiveTab('week')}
        >
          {t(lang, 'tab.week')}
        </button>
        <button
          type="button"
          className={tabButtonClass('overall')}
          onClick={() => setActiveTab('overall')}
        >
          {t(lang, 'tab.overall')}
        </button>
        <button
          type="button"
          className={tabButtonClass('galaxy')}
          onClick={() => setActiveTab('galaxy')}
        >
          {t(lang, 'tab.galaxy')}
        </button>
      </nav>

      <main className="flex-1 overflow-hidden px-4 py-3">
        {activeTab === 'board' ? (
          <div className="flex h-full flex-col gap-2">
            <div className="min-h-0 flex-1">
              <QuadrantBoard
                tasks={tasks}
                now={now}
                boardMode={boardMode}
                onModeChange={setBoardMode}
                onToggleDone={handleToggleDone}
                onCreateInQuadrant={handleCreateInQuadrant}
                onFilterByQuadrant={handleFilterByQuadrant}
                onEditTask={handleEditTask}
              />
            </div>
          </div>
        ) : null}

        {activeTab === 'week' ? (
          <WeekView now={now} lang={lang} />
        ) : null}

        {activeTab === 'overall' ? (
          <div className="h-full">
            <OverallGoalPanel />
          </div>
        ) : null}

        {activeTab === 'galaxy' ? (
          <ErrorBoundary label="星系模块" lang={lang}>
            <div className="h-full">
              <GalaxyView />
            </div>
          </ErrorBoundary>
        ) : null}
      </main>

      <TaskEditorDialog
        open={dialogOpen}
        mode={dialogMode}
        now={now}
        task={editingTask}
        initialHint={initialHint}
        onClose={handleDialogClose}
        onSubmitCreate={handleDialogSubmitCreate}
        onSubmitUpdate={handleDialogSubmitUpdate}
      />
    </div>
  )
}

export default Home
