/**
 * @file WeeklyReviewPanel component.
 * @description Weekly review content module, including highlights, blockers and next actions.
 */

import type { FC } from 'react'
import { useMemo } from 'react'
import { isSunday } from 'date-fns'
import type { Task, WeeklyReview, WeeklyReviewActionItem } from '../../types/task'
import { formatDateKey, getWeekRangeForDate } from '../../utils/dateUtils'
import { useTaskStore } from '../../store/useTaskStore'

/**
 * @description Props for WeeklyReviewPanel.
 */
export interface WeeklyReviewPanelProps {
  now: Date
  tasks: Task[]
  onCreateTaskFromAction: (payload: {
    review: WeeklyReview
    action: WeeklyReviewActionItem
  }) => void
}

/**
 * @description Determines whether current week review is editable (Sunday 13:00–23:59).
 */
function isCurrentWeekEditable(now: Date): boolean {
  if (!isSunday(now)) return false
  const hour = now.getHours()
  return hour >= 13 && hour <= 23
}

/**
 * @description Weekly review content UI with editability governed by time window.
 */
export const WeeklyReviewPanel: FC<WeeklyReviewPanelProps> = ({
  now,
  tasks,
  onCreateTaskFromAction,
}) => {
  const { weeklyReviews, upsertWeeklyReview, updateWeeklyReview, addNextAction, updateNextAction, deleteNextAction } =
    useTaskStore()

  const { start, end } = getWeekRangeForDate(now)
  const weekStartKey = formatDateKey(start)
  const weekEndKey = formatDateKey(end)
  const editable = isCurrentWeekEditable(now)

  const currentReview: WeeklyReview | null = useMemo(() => {
    const existing =
      weeklyReviews.find(
        (r) => r.weekStartDate === weekStartKey && r.weekEndDate === weekEndKey,
      ) ?? null
    if (existing) return existing
    if (!editable) return null
    return upsertWeeklyReview(weekStartKey, weekEndKey)
  }, [weeklyReviews, weekStartKey, weekEndKey, editable, upsertWeeklyReview])

  if (!currentReview) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white/90 p-3 shadow-sm">
        <h3 className="text-xs font-semibold uppercase text-slate-500">
          Weekly review
        </h3>
        <p className="mt-2 text-xs text-slate-500">
          Weekly review for this week is not created yet. It will be created
          automatically on Sunday afternoon.
        </p>
      </section>
    )
  }

  const handleUpdateField = (field: keyof WeeklyReview, value: string) => {
    if (!editable) return
    updateWeeklyReview(currentReview.id, { [field]: value })
  }

  const handleAddNextAction = () => {
    if (!editable) return
    addNextAction(currentReview.id, '')
  }

  const handleActionChange = (id: string, value: string) => {
    if (!editable) return
    updateNextAction(currentReview.id, id, { content: value })
  }

  const handleActionDelete = (id: string) => {
    if (!editable) return
    deleteNextAction(currentReview.id, id)
  }

  const handleConvertToTask = (action: WeeklyReviewActionItem) => {
    if (!editable) return
    if (action.status === 'converted') return
    onCreateTaskFromAction({ review: currentReview, action })
  }

  const editableNote = editable
    ? 'Editable now (Sunday 13:00–23:59).'
    : 'Read-only outside Sunday afternoon.'

  return (
    <section className="rounded-xl border border-slate-200 bg-white/90 p-3 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase text-slate-500">
          Weekly review · {weekStartKey} ~ {weekEndKey}
        </h3>
        <span className="text-[10px] text-slate-500">{editableNote}</span>
      </div>

      <div className="mt-2 space-y-2">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-slate-700">
            Highlights
          </label>
          <textarea
            className="h-16 w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
            value={currentReview.highlights}
            onChange={(e) => handleUpdateField('highlights', e.target.value)}
            readOnly={!editable}
            placeholder="What went well this week?"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-slate-700">
            Blockers
          </label>
          <textarea
            className="h-16 w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
            value={currentReview.blockers}
            onChange={(e) => handleUpdateField('blockers', e.target.value)}
            readOnly={!editable}
            placeholder="What were the obstacles?"
          />
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-medium text-slate-700">
              Next week actions
            </label>
            {editable ? (
              <button
                type="button"
                onClick={handleAddNextAction}
                className="rounded-full bg-slate-900 px-2 py-[2px] text-[10px] font-medium text-white hover:bg-slate-800"
              >
                ＋ Add
              </button>
            ) : null}
          </div>
          <div className="space-y-1">
            {currentReview.nextActions.length === 0 ? (
              <div className="rounded-md border border-dashed border-slate-200 px-2 py-1 text-[10px] text-slate-500">
                No actions yet.
              </div>
            ) : (
              currentReview.nextActions.map((action) => (
                <div
                  key={action.id}
                  className="flex items-start gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1"
                >
                  <textarea
                    className="h-10 flex-1 rounded-md border border-slate-200 px-1 py-1 text-[11px]"
                    value={action.content}
                    onChange={(e) => handleActionChange(action.id, e.target.value)}
                    readOnly={!editable}
                    placeholder="Describe next step..."
                  />
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      disabled={!editable || action.status === 'converted'}
                      onClick={() => handleConvertToTask(action)}
                      className={`rounded-md px-2 py-[2px] text-[10px] ${
                        action.status === 'converted'
                          ? 'border border-slate-300 bg-slate-100 text-slate-500'
                          : 'border border-emerald-500 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      }`}
                    >
                      {action.status === 'converted'
                        ? 'Task created'
                        : 'Convert to task'}
                    </button>
                    {editable ? (
                      <button
                        type="button"
                        onClick={() => handleActionDelete(action.id)}
                        className="rounded-md border border-red-300 bg-red-50 px-2 py-[2px] text-[10px] text-red-700 hover:bg-red-100"
                      >
                        Delete
                      </button>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
