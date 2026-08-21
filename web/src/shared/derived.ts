/**
 * @file Derived calculators (锚点小程序 MVP).
 * @description Runtime derivations: project progress, and the galaxy coordinate model.
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

/** Stable color palette for stars / planets (by index). */
export const GALAXY_PALETTE = [
  '#f472b6',
  '#a78bfa',
  '#34d399',
  '#fbbf24',
  '#fb923c',
  '#22d3ee',
  '#60a5fa',
  '#f87171',
]

/** Deterministic pseudo-random in [0,1) from a string id (stable across renders). */
function rand01(id: string, salt = 0): number {
  let h = 2166136261 ^ salt
  for (let i = 0; i < id.length; i++) {
    h = Math.imul(h ^ id.charCodeAt(i), 16777619)
  }
  return ((h >>> 0) % 1000) / 1000
}

export interface StarNode {
  goal: Goal
  cx: number
  cy: number
  color: string
  index: number
}

export interface PlanetNode {
  project: Project
  cx: number
  cy: number
  color: string
  progress: number
  goalId: string | null
  index: number
}

/** Moons = tasks attached to a project (satellites) or drifting as stardust. */
export interface MoonNode {
  task: Task
  cx: number
  cy: number
  projectId: string | null
  index: number
}

export interface DustNode {
  x: number
  y: number
  r: number
  o: number
}

export interface GalaxyModel {
  stars: StarNode[]
  planets: PlanetNode[]
  moons: MoonNode[]
  dust: DustNode[]
  width: number
  height: number
}

/**
 * @description Builds the multi-galaxy coordinate model with a CENTER-RADIAL layout:
 * - each active goal → a STAR (恒星) glowing, placed around the viewport center
 * - each project → a PLANET (小行星) orbiting its parent star (or the center if no goal)
 * - each task → a MOON (卫星) around its project, or drifting stardust around the center
 * - background DUST scattered deterministically across the canvas
 */
export function buildGalaxyModel(
  goals: Goal[],
  projects: Project[],
  tasks: Task[],
  edges: GraphEdge[],
  width: number,
  height: number,
  focusGoalId?: string | null,
): GalaxyModel {
  const W = Math.max(width, 820)
  const H = Math.max(height, 600)
  const cx = W / 2
  const cy = H / 2

  const activeGoals = goals.filter(
    (g) => g.status !== 'archived' && (!focusGoalId || g.id === focusGoalId),
  )

  // ---- Stars (goals) ----
  const stars: StarNode[] = activeGoals.map((g, i) => {
    let x: number
    let y: number
    const n = activeGoals.length
    if (n === 1) {
      x = cx
      y = cy
    } else {
      const R = Math.max(150, n * 70)
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2
      x = cx + Math.cos(angle) * R
      y = cy + Math.sin(angle) * R
    }
    return { goal: g, cx: x, cy: y, color: GALAXY_PALETTE[i % GALAXY_PALETTE.length], index: i }
  })
  const starById = new Map(stars.map((s) => [s.goal.id, s]))

  // ---- Planets (projects) — always shown, regardless of whether they have a goal ----
  const planets: PlanetNode[] = []
  const byGoal = new Map<string, Project[]>()
  const orphans: Project[] = []
  projects.forEach((p) => {
    if (p.status === 'archived') return
    if (focusGoalId && p.goalId !== focusGoalId) return
    if (p.goalId && starById.has(p.goalId)) {
      if (!byGoal.has(p.goalId)) byGoal.set(p.goalId, [])
      byGoal.get(p.goalId)!.push(p)
    } else {
      orphans.push(p)
    }
  })

  let planetIndex = 0
  byGoal.forEach((list, goalId) => {
    const star = starById.get(goalId)!
    const n = list.length
    list.forEach((p, i) => {
      const ring = Math.floor(i / 6)
      const offset = i % 6
      const orbit = 70 + ring * 34
      const spread = (offset - (Math.min(n, 6) - 1) / 2) * (Math.PI / 7)
      const angle = (i / Math.max(1, n)) * Math.PI * 2 + spread
      planets.push({
        project: p,
        cx: star.cx + Math.cos(angle) * orbit,
        cy: star.cy + Math.sin(angle) * orbit,
        color: star.color,
        progress: computeProjectProgress(p.id, tasks, edges),
        goalId: goalId,
        index: planetIndex++,
      })
    })
  })

  // Orphan planets: orbit the center as a separate belt
  orphans.forEach((p, i) => {
    const orbit = Math.max(220, activeGoals.length * 70 + 60)
    const angle = (i / Math.max(1, orphans.length)) * Math.PI * 2 + rand01(p.id, 7) * 0.6
    planets.push({
      project: p,
      cx: cx + Math.cos(angle) * orbit,
      cy: cy + Math.sin(angle) * orbit,
      color: '#94a3b8',
      progress: computeProjectProgress(p.id,  tasks, edges),
      goalId: null,
      index: planetIndex++,
    })
  })

  // ---- Moons (tasks) ----
  const moons: MoonNode[] = []
  let moonIndex = 0
  tasks.forEach((t) => {
    if (t.status === 'done') return
    // Resolve the project this task is linked to (either direction).
    let linkedProjectId: string | null = null
    for (const e of edges) {
      if (e.fromType === 'task' && e.fromId === t.id && e.toType === 'project') linkedProjectId = e.toId
      else if (e.toType === 'task' && e.toId === t.id && e.fromType === 'project') linkedProjectId = e.fromId
    }

    if (linkedProjectId) {
      const planet = planets.find((p) => p.project.id === linkedProjectId)
      if (planet) {
        const a = rand01(t.id, 3) * Math.PI * 2
        const r = 22 + rand01(t.id, 5) * 14
        moons.push({
          task: t,
          cx:
            planet.cx + Math.cos(a) * r,
          cy: planet.cy + Math.sin(a) * r,
          projectId: linkedProjectId,
          index: moonIndex++,
        })
        return
      }
    }
      // Focus mode: keep unrelated tasks out of the focused galaxy.
      if (focusGoalId) return
      // No linked project → drift as stardust around the center
      const a = rand01(t.id, 11) * Math.PI * 2
    const r = 280 + rand01(t.id, 13) * 120
    moons.push({
      task: t,
      cx: cx + Math.cos(a) * r,
      cy: cy + Math.sin(a) * r,
      projectId: null,
      index: moonIndex++,
    })
  })

  // ---- Background dust ----
  const dust: DustNode[] = []
  const dustCount = 70
  for (let i = 0; i < dustCount; i++) {
    const id = `dust-${i}`
    dust.push({
      x: rand01(id, 1) * W,
      y: rand01(id, 2) * H,
      r: 0.6 + rand01(id, 3) * 1.6,
      o: 0.2 + rand01(id, 4) * 0.5,
    })
  }

  return { stars, planets, moons, dust, width: W, height: H }
}
