/**
 * @file Derived calculators (锚点小程序 MVP).
 * @description Runtime derivations: project progress, and the galaxy coordinate model.
 * These are derived (not persisted) from goals / projects / tasks / edges.
 *
 * @see docs/02-开发技术文档.md §4.3
 */

import type { Goal, GraphEdge, Project, Task } from '../types/task'

/**
 * @description Returns the ids of tasks attached to a project via graph edges.
 */
export function getProjectTaskIds(projectId: string, edges: GraphEdge[]): string[] {
  return edges
    .filter(
      (e) =>
        (e.fromType === 'project' && e.fromId === projectId && e.toType === 'task') ||
        (e.toType === 'project' && e.toId === projectId && e.fromType === 'task'),
    )
    .map((e) => (e.fromType === 'task' ? e.fromId : e.toId))
}

/**
 * @description Project progress = doneTasks / totalTasks (0-1).
 */
export function computeProjectProgress(
  projectId: string,
  tasks: Task[],
  edges: GraphEdge[],
): number {
  const ids = getProjectTaskIds(projectId, edges)
  if (ids.length === 0) return 0
  const related = tasks.filter((t) => ids.includes(t.id))
  if (related.length === 0) return 0
  const done = related.filter((t) => t.status === 'done').length
  return done / related.length
}

export interface StarNode {
  goal: Goal
  cx: number
  cy: number
}

export interface PlanetNode {
  project: Project
  cx: number
  cy: number
  progress: number
  goalId: string
}

export interface ScatterNode {
  task: Task
  cx: number
  cy: number
}

export interface GalaxyLink {
  x1: number
  y1: number
  x2: number
  y2: number
  strength?: number
}

export interface GalaxyModel {
  stars: StarNode[]
  planets: PlanetNode[]
  scatter: ScatterNode[]
  links: GalaxyLink[]
  width: number
  height: number
}

function nodeCoord(
  type: 'goal' | 'project',
  id: string,
  stars: StarNode[],
  planets: PlanetNode[],
): { x: number; y: number } | null {
  if (type === 'goal') {
    const s = stars.find((x) => x.goal.id === id)
    return s ? { x: s.cx, y: s.cy } : null
  }
  const p = planets.find((x) => x.project.id === id)
  return p ? { x: p.cx, y: p.cy } : null
}

/**
 * @description Builds the multi-galaxy coordinate model:
 * - each active goal → a star (恒星)
 * - each project → a planet (行星) orbiting its parent star, sized by progress
 * - tasks with no project → scatter points (散点) in a bottom band
 * - cross_galaxy edges → dashed links
 */
export function buildGalaxyModel(
  goals: Goal[],
  projects: Project[],
  tasks: Task[],
  edges: GraphEdge[],
): GalaxyModel {
  const STAR_GAP = 340
  const STAR_START_X = 200
  const STAR_Y = 220
  const ORBIT = 120

  const activeGoals = goals.filter((g) => g.status !== 'archived')
  const stars: StarNode[] = activeGoals.map((g, i) => ({
    goal: g,
    cx: STAR_START_X + i * STAR_GAP,
    cy: STAR_Y,
  }))

  const findStar = (goalId?: string | null) =>
    goalId ? stars.find((s) => s.goal.id === goalId) : undefined

  const planets: PlanetNode[] = []
  projects.forEach((p) => {
    if (p.status === 'archived') return
    const center = findStar(p.goalId)
    if (!center) return
    const siblings = projects.filter(
      (x) => x.goalId === p.goalId && x.status !== 'archived',
    )
    const idx = siblings.findIndex((x) => x.id === p.id)
    const angle = (idx / Math.max(1, siblings.length)) * Math.PI * 2 - Math.PI / 2
    planets.push({
      project: p,
      goalId: p.goalId as string,
      cx: center.cx + Math.cos(angle) * ORBIT,
      cy: center.cy + Math.sin(angle) * ORBIT,
      progress: computeProjectProgress(p.id, tasks, edges),
    })
  })

  // Scatter: tasks not attached to any project.
  const linkedTaskIds = new Set<string>()
  edges.forEach((e) => {
    if (e.fromType === 'task') linkedTaskIds.add(e.fromId)
    if (e.toType === 'task') linkedTaskIds.add(e.toId)
  })
  const scatterTasks = tasks.filter(
    (t) => !linkedTaskIds.has(t.id) && t.status !== 'done',
  )
  const SCATTER_COLS = 20
  const SCATTER_Y = STAR_Y + 240
  const scatter: ScatterNode[] = scatterTasks.map((t, i) => ({
    task: t,
    cx: 120 + (i % SCATTER_COLS) * 60,
    cy: SCATTER_Y + Math.floor(i / SCATTER_COLS) * 44,
  }))

  const links: GalaxyLink[] = []
  edges.forEach((e) => {
    if (e.relation !== 'cross_galaxy') return
    const a = nodeCoord(e.fromType, e.fromId, stars, planets)
    const b = nodeCoord(e.toType, e.toId, stars, planets)
    if (a && b) links.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, strength: e.strength })
  })

  const width = Math.max(
    STAR_START_X + (activeGoals.length - 1) * STAR_GAP + 200,
    120 + SCATTER_COLS * 60,
  )
  const height = SCATTER_Y + 160

  return { stars, planets, scatter, links, width, height }
}
