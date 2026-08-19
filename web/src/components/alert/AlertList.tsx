import { useMemo } from 'react'
import { useTaskStore } from '../../store/useTaskStore'
import { generateAlerts } from '../../shared/alert/rules'
import { AlertTriangle, Info } from 'lucide-react'

/**
 * @description Alert list view — rule-based, friendly peer tone, no LLM required.
 */
export function AlertList() {
  const goals = useTaskStore((s) => s.goals)
  const projects = useTaskStore((s) => s.projects)
  const tasks = useTaskStore((s) => s.tasks)
  const edges = useTaskStore((s) => s.graphEdges)

  const alerts = useMemo(
    () => generateAlerts(goals, projects, tasks, edges),
    [goals, projects, tasks, edges],
  )

  if (alerts.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-center text-sm text-slate-400">
        暂时没有需要提醒的，一切平稳 ✨
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {alerts.map((a) => (
        <div
          key={a.id}
          className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${
            a.level === 'warn'
              ? 'border-amber-200 bg-amber-50 text-amber-800'
              : 'border-slate-200 bg-white text-slate-700'
          }`}
        >
          {a.level === 'warn' ? (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          ) : (
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          )}
          <span>{a.text}</span>
        </div>
      ))}
    </div>
  )
}
