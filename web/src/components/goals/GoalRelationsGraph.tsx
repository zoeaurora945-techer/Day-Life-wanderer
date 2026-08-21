/**
 * @file GoalRelationsGraph component.
 * @description "蓝图" (Blueprint) relationship graph for goals and projects.
 *
 * Design intent (vs. the dark, immersive 星系/Galaxy view):
 * - This is the *workbench* view: light, airy, tool-like.
 * - Edges are soft quadratic-bezier curves (not straight lines) so they no
 *   longer feel like a rigid web that crosses itself.
 * - Each goal owns an angular "sector"; its projects fan out inside that
 *   sector, which keeps subtrees spatially separated and cuts crossings.
 * - Nodes are colored by status and sized by completion progress.
 * - A status filter lets the user focus on active / paused / completed work.
 *
 * 当前展示 Goal / Project 两层：
 * - Goal：内圈（恒星/太阳意象，金色）
 * - Project：围绕其主 Goal 外圈扇区；无主 Goal 的 Project 放在最外圈
 */

import type { FC } from 'react'
import { useMemo, useRef, useState, useEffect } from 'react'
import type { GraphEdge, Goal, Project, Task } from '../../types/task'
import { useTaskStore } from '../../store/useTaskStore'
import { t } from '../../i18n/translations'

/**
 * @description Visual node type for layout (goal / project).
 */
interface LayoutNode {
  id: string
  entityId: string
  label: string
  type: 'goal' | 'project'
  x: number
  y: number
  /** Color role key used to pick fill/stroke. */
  tone: 'goal' | 'active' | 'paused' | 'completed' | 'orphan'
  /** Completion fraction 0..1 (linked tasks done / total). */
  progress: number
}

/**
 * @description Visual edge type for layout.
 */
interface LayoutEdge {
  id: string
  sourceId: string
  targetId: string
}

/**
 * @description Adjacency map for hover highlighting.
 */
type AdjacencyMap = Map<string, Set<string>>

/**
 * @description Props for GoalRelationsGraph (goals + projects + tasks).
 */
export interface GoalRelationsGraphProps {
  goals: Goal[]
  projects: Project[]
  tasks: Task[]
  graphEdges: GraphEdge[]
  onNodeClick?: (payload: { type: 'goal' | 'project'; id: string }) => void
}

/**
 * @description Collects, per goal/project, the set of linked task ids.
 */
function collectLinkedTaskIds(
  edges: GraphEdge[],
): { byGoal: Map<string, Set<string>>; byProject: Map<string, Set<string>> } {
  const byGoal = new Map<string, Set<string>>()
  const byProject = new Map<string, Set<string>>()
  const add = (map: Map<string, Set<string>>, key: string, val: string) => {
    if (!map.has(key)) map.set(key, new Set())
    map.get(key)!.add(val)
  }
  for (const e of edges) {
    if (e.fromType === 'task' && e.toType === 'goal') add(byGoal, e.toId, e.fromId)
    else if (e.fromType === 'goal' && e.toType === 'task') add(byGoal, e.fromId, e.toId)
    else if (e.fromType === 'task' && e.toType === 'project') add(byProject, e.toId, e.fromId)
    else if (e.fromType === 'project' && e.toType === 'task') add(byProject, e.fromId, e.toId)
  }
  return { byGoal, byProject }
}

/**
 * @description Completion fraction for a set of linked task ids.
 */
function progressFor(taskIds: Set<string> | undefined, tasks: Task[]): number {
  if (!taskIds || taskIds.size === 0) return 0
  const linked = tasks.filter((tk) => taskIds.has(tk.id))
  if (linked.length === 0) return 0
  const done = linked.filter((tk) => tk.status === 'done').length
  return done / linked.length
}

/**
 * @description Builds layout nodes/edges for a goal-project blueprint graph.
 *
 * Layout: radial. Each goal gets a sector; its projects fan out inside it.
 */
function buildLayout(
  goals: Goal[],
  projects: Project[],
  tasks: Task[],
  graphEdges: GraphEdge[],
  viewportWidth: number,
  viewportHeight: number,
): { nodes: LayoutNode[]; edges: LayoutEdge[]; adjacency: AdjacencyMap } {
  const centerX = 0
  const centerY = 0

  const goalMap = new Map<string, Goal>(goals.map((g) => [g.id, g]))
  const projectMap = new Map<string, Project>(projects.map((p) => [p.id, p]))

  const { byGoal, byProject } = collectLinkedTaskIds(graphEdges)

  // ---- 仅保留 goal ↔ project 的边 ----
  const goalProjectEdges: GraphEdge[] = []
  for (const edge of graphEdges) {
    const isGoalProjectEdge =
      (edge.fromType === 'goal' && edge.toType === 'project') ||
      (edge.fromType === 'project' && edge.toType === 'goal')
    if (isGoalProjectEdge) goalProjectEdges.push(edge)
  }

  // ---- 计算每个 project 的主 Goal ----
  const primaryGoalByProject = new Map<string, string>()
  projectMap.forEach((project) => {
    if (project.goalId && goalMap.has(project.goalId)) {
      primaryGoalByProject.set(project.id, project.goalId)
    }
  })
  for (const edge of goalProjectEdges) {
    const projectId = edge.fromType === 'project' ? edge.fromId : edge.toId
    const goalId = edge.fromType === 'goal' ? edge.fromId : edge.toId
    if (!projectId || !goalId) continue
    if (!goalMap.has(goalId) || !projectMap.has(projectId)) continue
    if (!primaryGoalByProject.has(projectId)) {
      primaryGoalByProject.set(projectId, goalId)
    }
  }

  const logicalNodes: LayoutNode[] = []
  const layoutEdges: LayoutEdge[] = []
  const adjacency: AdjacencyMap = new Map()

  const addAdjacency = (a: string, b: string) => {
    if (!adjacency.has(a)) adjacency.set(a, new Set())
    if (!adjacency.has(b)) adjacency.set(b, new Set())
    adjacency.get(a)!.add(b)
    adjacency.get(b)!.add(a)
  }

  // ---- 第 1 步：逻辑坐标布局 ----
  const goalCount = Math.max(goals.length, 1)
  const goalRadius = 92
  const projectBaseRadius = goalRadius + 46

  const goalPositionById = new Map<string, { x: number; y: number; angle: number }>()

  goals.forEach((goal, index) => {
    const angle = (2 * Math.PI * index) / goalCount - Math.PI / 2
    const x = centerX + goalRadius * Math.cos(angle)
    const y = centerY + goalRadius * Math.sin(angle)
    const nodeId = `goal-${goal.id}`
    goalPositionById.set(goal.id, { x, y, angle })
    logicalNodes.push({
      id: nodeId,
      entityId: goal.id,
      label: goal.title,
      type: 'goal',
      x,
      y,
      tone: goal.status === 'archived' ? 'completed' : 'goal',
      progress: progressFor(byGoal.get(goal.id), tasks),
    })
  })

  // 将有主 Goal 的项目分组，围绕各自 Goal 在扇区内排布
  const projectsByGoal = new Map<string, Project[]>()
  primaryGoalByProject.forEach((goalId, projectId) => {
    const project = projectMap.get(projectId)
    if (!project) return
    if (!projectsByGoal.has(goalId)) projectsByGoal.set(goalId, [])
    projectsByGoal.get(goalId)!.push(project)
  })

  projectsByGoal.forEach((goalProjects, goalId) => {
    const goalPos = goalPositionById.get(goalId)
    if (!goalPos) return
    const { angle: baseAngle } = goalPos
    const count = goalProjects.length
    goalProjects.forEach((project, index) => {
      const ringIndex = Math.floor(index / 6)
      const offsetIndex = index % 6
      const angleSpread = Math.PI / 7
      const effectiveCount = Math.min(count, 6)
      const offset =
        (offsetIndex - (effectiveCount - 1) / 2) * (angleSpread / Math.max(effectiveCount, 1))
      const radius = projectBaseRadius + ringIndex * 30
      const angle = baseAngle + offset
      const x = centerX + radius * Math.cos(angle)
      const y = centerY + radius * Math.sin(angle)
      const nodeId = `project-${project.id}`
      logicalNodes.push({
        id: nodeId,
        entityId: project.id,
        label: project.title,
        type: 'project',
        x,
        y,
        tone: project.status === 'paused'
          ? 'paused'
          : project.status === 'completed' || project.status === 'archived'
          ? 'completed'
          : 'active',
        progress: progressFor(byProject.get(project.id), tasks),
      })
    })
  })

  // 没有主 Goal 的孤立项目：放在最外圈
  const orphanProjects: Project[] = []
  projectMap.forEach((project) => {
    if (!primaryGoalByProject.has(project.id)) orphanProjects.push(project)
  })
  if (orphanProjects.length > 0) {
    const radius = projectBaseRadius + 72
    orphanProjects.forEach((project, index) => {
      const angle = (2 * Math.PI * index) / orphanProjects.length + Math.PI / 6
      const x = centerX + radius * Math.cos(angle)
      const y = centerY + radius * Math.sin(angle)
      const nodeId = `project-${project.id}`
      if (logicalNodes.some((n) => n.id === nodeId)) return
      logicalNodes.push({
        id: nodeId,
        entityId: project.id,
        label: project.title,
        type: 'project',
        x,
        y,
        tone: 'orphan',
        progress: progressFor(byProject.get(project.id), tasks),
      })
    })
  }

  // 创建所有 goal↔project 可见边
  goalProjectEdges.forEach((edge, index) => {
    const sourceNodeId = `${edge.fromType}-${edge.fromId}`
    const targetNodeId = `${edge.toType}-${edge.toId}`
    const hasSource = logicalNodes.some((n) => n.id === sourceNodeId)
    const hasTarget = logicalNodes.some((n) => n.id === targetNodeId)
    if (!hasSource || !hasTarget) return
    layoutEdges.push({ id: `edge-${index}`, sourceId: sourceNodeId, targetId: targetNodeId })
    addAdjacency(sourceNodeId, targetNodeId)
  })

  if (logicalNodes.length === 0) return { nodes: [], edges: [], adjacency }

  // ---- 第 2 步：Fit-to-viewport ----
  const padding = 28
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  logicalNodes.forEach((node) => {
    if (node.x < minX) minX = node.x
    if (node.x > maxX) maxX = node.x
    if (node.y < minY) minY = node.y
    if (node.y > maxY) maxY = node.y
  })
  const labelMargin = 64
  minX -= labelMargin
  maxX += labelMargin
  minY -= labelMargin
  maxY += labelMargin

  const contentWidth = Math.max(maxX - minX, 1)
  const contentHeight = Math.max(maxY - minY, 1)
  const availableWidth = Math.max(viewportWidth - padding * 2, 1)
  const availableHeight = Math.max(viewportHeight - padding * 2, 1)
  const scale = Math.min(availableWidth / contentWidth, availableHeight / contentHeight, 1)
  const contentCenterX = (minX + maxX) / 2
  const contentCenterY = (minY + maxY) / 2
  const viewportCenterX = viewportWidth / 2
  const viewportCenterY = viewportHeight / 2

  const finalNodes: LayoutNode[] = logicalNodes.map((node) => {
    const dx = node.x - contentCenterX
    const dy = node.y - contentCenterY
    return { ...node, x: dx * scale + viewportCenterX, y: dy * scale + viewportCenterY }
  })

  return { nodes: finalNodes, edges: layoutEdges, adjacency }
}

/**
 * @description Returns a soft quadratic-bezier path between two points, bowed
 * away from the center so edges read as gentle arcs instead of rigid lines.
 */
function curvedPath(sx: number, sy: number, tx: number, ty: number): string {
  const mx = (sx + tx) / 2
  const my = (sy + ty) / 2
  const dx = tx - sx
  const dy = ty - sy
  const len = Math.hypot(dx, dy) || 1
  const bow = Math.min(len * 0.22, 28)
  const cx = mx - (dy / len) * bow
  const cy = my + (dx / len) * bow
  return `M ${sx} ${sy} Q ${cx} ${cy} ${tx} ${ty}`
}

/**
 * @description Maps a node tone to Tailwind fill / stroke classes (light theme).
 */
function toneClasses(tone: LayoutNode['tone'], active: boolean): { fill: string; stroke: string } {
  switch (tone) {
    case 'goal':
      return active
        ? { fill: 'fill-amber-400', stroke: 'stroke-amber-600' }
        : { fill: 'fill-amber-300', stroke: 'stroke-amber-500' }
    case 'active':
      return active
        ? { fill: 'fill-emerald-500', stroke: 'stroke-emerald-700' }
        : { fill: 'fill-emerald-400', stroke: 'stroke-emerald-600' }
    case 'paused':
      return active
        ? { fill: 'fill-sky-400', stroke: 'stroke-sky-600' }
        : { fill: 'fill-sky-300', stroke: 'stroke-sky-500' }
    case 'completed':
      return active
        ? { fill: 'fill-slate-400', stroke: 'stroke-slate-600' }
        : { fill: 'fill-slate-300', stroke: 'stroke-slate-400' }
    case 'orphan':
    default:
      return active
        ? { fill: 'fill-violet-400', stroke: 'stroke-violet-600' }
        : { fill: 'fill-violet-300', stroke: 'stroke-violet-500' }
  }
}

/**
 * @description Radius for a node, scaled by completion progress.
 */
function nodeRadius(node: LayoutNode, active: boolean): number {
  const base = node.type === 'goal' ? 9 : 5
  const grow = node.type === 'goal' ? 6 : 4
  const r = base + node.progress * grow
  return active ? r + 2 : r
}

type StatusFilter = 'all' | 'active' | 'paused' | 'completed'

/**
 * @description Blueprint relationship graph — light, airy, tool-like.
 */
export const GoalRelationsGraph: FC<GoalRelationsGraphProps> = ({
  goals,
  projects,
  tasks,
  graphEdges,
  onNodeClick,
}) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const lang = useTaskStore((state) => state.lang)
  const addGraphEdge = useTaskStore((state) => state.addGraphEdge)

  const [dimensions, setDimensions] = useState({ width: 800, height: 420 })
  const { width, height } = dimensions

  const containerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect
        if (w > 0 && h > 0) {
          setDimensions({
            width: Math.max(Math.round(w), 400),
            height: Math.max(Math.round(h), 300),
          })
        }
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Apply status filter: which project nodes remain visible.
  const visibleProjectIds = useMemo(() => {
    const set = new Set<string>()
    projects.forEach((p) => {
      const isOrphan = !p.goalId && !graphEdges.some(
        (e) =>
          (e.fromType === 'project' && e.toId === p.id && e.toType === 'goal') ||
          (e.toType === 'project' && e.fromId === p.id && e.fromType === 'goal'),
      )
      if (statusFilter === 'all') set.add(p.id)
      else if (isOrphan) return
      else if ((p.status ?? 'active') === statusFilter) set.add(p.id)
    })
    return set
  }, [projects, graphEdges, statusFilter])

  const { nodes, edges, adjacency } = useMemo(() => {
    const laid = buildLayout(
      goals,
      projects,
      tasks,
      graphEdges,
      dimensions.width,
      dimensions.height,
    )
    // Filter out invisible project nodes + their edges.
    const visibleNodes = laid.nodes.filter(
      (n) => n.type === 'goal' || visibleProjectIds.has(n.entityId),
    )
    const visibleNodeIds = new Set(visibleNodes.map((n) => n.id))
    const visibleEdges = laid.edges.filter(
      (e) => visibleNodeIds.has(e.sourceId) && visibleNodeIds.has(e.targetId),
    )
    // Rebuild adjacency for visible set only.
    const adj: AdjacencyMap = new Map()
    const addAdj = (a: string, b: string) => {
      if (!adj.has(a)) adj.set(a, new Set())
      if (!adj.has(b)) adj.set(b, new Set())
      adj.get(a)!.add(b)
      adj.get(b)!.add(a)
    }
    visibleEdges.forEach((e) => addAdj(e.sourceId, e.targetId))
    return { nodes: visibleNodes, edges: visibleEdges, adjacency: adj }
  }, [goals, projects, tasks, graphEdges, dimensions.width, dimensions.height, visibleProjectIds])

  const hasAnyEntity = goals.length > 0 || projects.length > 0

  const filterOptions: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: t(lang, 'overall.filter_all') },
    { key: 'active', label: t(lang, 'overall.project_status_active') },
    { key: 'paused', label: t(lang, 'overall.project_status_paused') },
    { key: 'completed', label: t(lang, 'overall.project_status_completed') },
  ]

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden rounded-none bg-gradient-to-br from-slate-50 via-white to-sky-50/50"
    >
      <svg
        viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
        className="absolute inset-0 h-full w-full"
        role="img"
        aria-label="Life blueprint: goals and projects relationship graph. Hover to inspect, click two nodes to link."
      >
        <defs>
          <pattern
            id="blueprint-dot-pattern"
            x="0"
            y="0"
            width="20"
            height="20"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="1" cy="1" r="1" className="fill-slate-200" />
          </pattern>
        </defs>
        <rect x={0} y={0} width={width} height={height} fill="url(#blueprint-dot-pattern)" />

        {/* Edges — soft curved connectors */}
        <g>
          {edges.map((edge) => {
            const source = nodes.find((n) => n.id === edge.sourceId)
            const target = nodes.find((n) => n.id === edge.targetId)
            if (!source || !target) return null
            const isActiveByHover =
              hoveredId != null && (edge.sourceId === hoveredId || edge.targetId === hoveredId)
            const isActiveBySelect =
              selectedNodeId != null &&
              (edge.sourceId === selectedNodeId || edge.targetId === selectedNodeId)
            const isActive = isActiveByHover || isActiveBySelect
            return (
              <path
                key={edge.id}
                d={curvedPath(source.x, source.y, target.x, target.y)}
                fill="none"
                className={
                  isActive
                    ? 'stroke-slate-400 stroke-[1.6] opacity-90 transition-all duration-200'
                    : 'stroke-slate-300 stroke-[1.1] opacity-60 transition-all duration-200'
                }
              />
            )
          })}
        </g>

        {/* Nodes */}
        <g>
          {nodes.map((node) => {
            const isHovered = node.id === hoveredId
            const isNeighbor =
              hoveredId != null && adjacency.get(hoveredId)?.has(node.id)
            const isSelected = node.id === selectedNodeId
            const isNeighborOfSelected =
              selectedNodeId != null && adjacency.get(selectedNodeId)?.has(node.id)
            const shouldDimContext = hoveredId != null || selectedNodeId != null
            const isDimmed =
              shouldDimContext &&
              !isHovered &&
              !isNeighbor &&
              !isSelected &&
              !isNeighborOfSelected

            const isActiveNode = isHovered || isSelected
            const radius = nodeRadius(node, isActiveNode)
            const { fill, stroke } = toneClasses(node.tone, isActiveNode)
            const labelOffsetX = node.x >= width / 2 ? 9 : -9
            const textAnchor = node.x >= width / 2 ? 'start' : 'end'

            const handleClick = () => {
              const payload = { type: node.type, id: node.entityId }
              onNodeClick?.(payload)
              if (selectedNodeId === null) {
                setSelectedNodeId(node.id)
                return
              }
              if (selectedNodeId === node.id) {
                setSelectedNodeId(null)
                return
              }
              const selectedNode = nodes.find((n) => n.id === selectedNodeId)
              if (!selectedNode) {
                setSelectedNodeId(node.id)
                return
              }
              const aType = selectedNode.type
              const aId = selectedNode.entityId
              const bType = node.type
              const bId = node.entityId
              if (aType === bType) {
                setSelectedNodeId(null)
                return
              }
              const alreadyExists = graphEdges.some(
                (edge) =>
                  ((edge.fromType === aType &&
                    edge.fromId === aId &&
                    edge.toType === bType &&
                    edge.toId === bId) ||
                    (edge.fromType === bType &&
                      edge.fromId === bId &&
                      edge.toType === aType &&
                      edge.toId === aId)) &&
                  edge.relation === 'supports',
              )
              if (!alreadyExists) {
                addGraphEdge({
                  fromType: aType,
                  fromId: aId,
                  toType: bType,
                  toId: bId,
                  relation: 'supports',
                })
              }
              setSelectedNodeId(null)
            }

            return (
              <g
                key={node.id}
                className="cursor-pointer transition-opacity duration-200"
                style={{ opacity: isDimmed ? 0.25 : 1 }}
                onMouseEnter={() => setHoveredId(node.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={handleClick}
              >
                {/* soft halo for an airy glow */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={radius + 4}
                  className={`${fill} opacity-20`}
                />
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={radius}
                  className={`${fill} ${stroke} transition-all duration-200`}
                  strokeWidth={1.4}
                />
                <text
                  x={node.x + labelOffsetX}
                  y={node.y - radius - 3}
                  textAnchor={textAnchor}
                  className={`select-none text-[10px] font-medium ${
                    isDimmed ? 'fill-slate-300' : 'fill-slate-600'
                  }`}
                >
                  {node.label}
                </text>
              </g>
            )
          })}
        </g>
      </svg>

      {/* Status filter chips */}
      <div className="absolute right-3 top-3 z-10 flex flex-wrap justify-end gap-1">
        {filterOptions.map((opt) => {
          const active = statusFilter === opt.key
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => setStatusFilter(opt.key)}
              className={`rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors ${
                active
                  ? 'bg-slate-900 text-white'
                  : 'bg-white/80 text-slate-500 ring-1 ring-slate-200 hover:bg-white hover:text-slate-700'
              }`}
            >
              {opt.label}
            </button>
          )
        })}
      </div>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 z-10 rounded-lg bg-white/80 px-2.5 py-2 text-[10px] text-slate-500 ring-1 ring-slate-200 backdrop-blur-sm">
        <div className="mb-1 font-semibold text-slate-600">{t(lang, 'overall.legend_title')}</div>
        <div className="flex flex-col gap-0.5">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-400" /> {t(lang, 'overall.legend_goal')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400" /> {t(lang, 'overall.project_status_active')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-sky-300" /> {t(lang, 'overall.project_status_paused')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-slate-300" /> {t(lang, 'overall.project_status_completed')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-violet-300" /> {t(lang, 'overall.orphan_project')}
          </span>
          <span className="mt-0.5 text-slate-400">{t(lang, 'overall.legend_size')}</span>
        </div>
      </div>

      {!hasAnyEntity && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <p className="rounded-full bg-white/90 px-3 py-1.5 text-[11px] text-slate-500 ring-1 ring-slate-200">
            {t(lang, 'galaxy.empty')}
          </p>
        </div>
      )}
    </div>
  )
}
