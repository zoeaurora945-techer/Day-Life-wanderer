import { useMemo } from 'react'
import { useTaskStore } from '../../store/useTaskStore'
import type { Task } from '../../types/task'
import { Check, Circle, MessageSquareText } from 'lucide-react'

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

/**
 * @description Scatter timeline of "每天说一句" entries (散点流).
 * Shows each log with the tasks it produced and their completion state.
 */
export function DailyLogList() {
  const logs = useTaskStore((s) => s.dailyLogs)
  const tasks = useTaskStore((s) => s.tasks)

  const taskMap = useMemo(() => {
    const m: Record<string, Task> = {}
    tasks.forEach((t) => (m[t.id] = t))
    return m
  }, [tasks])

  const sorted = useMemo(
    () => [...logs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [logs],
  )

  if (sorted.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-400">
        <MessageSquareText className="mx-auto mb-2 h-6 w-6 text-slate-300" />
        还没有任何记录。在上方说一句，系统会帮你拆成可执行的任务 ✨
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {sorted.map((log) => (
        <div key={log.id} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="mb-1 text-xs text-slate-400">{fmtTime(log.createdAt)}</div>
          <div className="text-sm text-slate-800">{log.userText}</div>
          {log.parsedTaskIds.length > 0 && (
            <ul className="mt-2 space-y-1 border-t border-slate-100 pt-2">
              {log.parsedTaskIds.map((tid) => {
                const t = taskMap[tid]
                if (!t) return null
                const done = t.status === 'done'
                return (
                  <li key={tid} className="flex items-center gap-2 text-sm">
                    {done ? (
                      <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                    ) : (
                      <Circle className="h-3.5 w-3.5 shrink-0 text-slate-300" />
                    )}
                    <span className={done ? 'text-slate-400 line-through' : 'text-slate-700'}>
                      {t.title}
                    </span>
                    {t.servesGoal && (
                      <span className="rounded bg-amber-100 px-1 text-[10px] text-amber-700">主线</span>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      ))}
    </div>
  )
}
