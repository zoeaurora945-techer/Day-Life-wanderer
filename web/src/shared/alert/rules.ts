/**
 * @file Alert rules (锚点小程序 MVP).
 * @description Rule-based alerts with friendly, peer-to-peer tone (no LLM required).
 * Mirrors the tone spec in 需求说明文档 §8.
 *
 * @see docs/02-开发技术文档.md §5.3 / §6.3
 */

import type { Goal, GraphEdge, Project, Task } from '../../types/task'
import { getProjectTaskIds } from '../derived'

export interface Alert {
  id: string
  level: 'info' | 'warn'
  text: string
  relatedId?: string
}

/**
 * @description Generates alerts from current state using simple rules.
 */
export function generateAlerts(
  goals: Goal[],
  projects: Project[],
  tasks: Task[],
  edges: GraphEdge[],
  now: Date = new Date(),
): Alert[] {
  const alerts: Alert[] = []
  const DAY = 86400000

  // 1) Tasks due within 24h and not done.
  tasks.forEach((t) => {
    if (t.status === 'done') return
    const due = new Date(t.dueAt).getTime()
    const diff = due - now.getTime()
    if (diff > 0 && diff < DAY) {
      alerts.push({
        id: `due-${t.id}`,
        level: 'warn',
        text: `「${t.title}」快到时间啦，记得安排一下～`,
        relatedId: t.id,
      })
    }
  })

  // 2) Tasks stuck in 'doing' for 7+ days.
  tasks.forEach((t) => {
    if (t.status !== 'doing') return
    const age = now.getTime() - new Date(t.createdAt).getTime()
    if (age > 7 * DAY) {
      alerts.push({
        id: `stale-${t.id}`,
        level: 'info',
        text: `「${t.title}」进行中有点久了，需要拆分或推进一下吗？`,
        relatedId: t.id,
      })
    }
  })

  // 3) Projects whose tasks are all done.
  projects.forEach((p) => {
    if (p.status === 'archived') return
    const ids = getProjectTaskIds(p.id, edges)
    if (ids.length === 0) return
    const related = tasks.filter((t) => ids.includes(t.id))
    if (related.length > 0 && related.every((t) => t.status === 'done')) {
      alerts.push({
        id: `done-${p.id}`,
        level: 'info',
        text: `「${p.title}」的任务都完成啦，可以收尾归档咯 🎉`,
        relatedId: p.id,
      })
    }
  })

  // 4) Goals with no projects yet.
  goals.forEach((g) => {
    if (g.status === 'archived') return
    const has = projects.some((p) => p.goalId === g.id)
    if (!has) {
      alerts.push({
        id: `empty-${g.id}`,
        level: 'info',
        text: `「${g.title}」还没有具体项目，想加点什么让它落地吗？`,
        relatedId: g.id,
      })
    }
  })

  return alerts
}
