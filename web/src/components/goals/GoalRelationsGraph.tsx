/**
 * @file GoalRelationsGraph component.
 * @description Obsidian-like relationship graph for goals and projects,
 * rendered as an SVG scatter/network, with automatic fit-to-viewport so
 * all nodes stay inside the visible area.
 *
 * 当前仅展示 Goal / Project 两层：
 * - Goal：内圈
 * - Project：围绕其主 Goal 的外圈；没有主 Goal 的 Project 放在更外圈
 */

import type { FC } from 'react'
import { useMemo, useRef, useState, useEffect } from 'react'
import type { GraphEdge, Goal, Project } from '../../types/task'
import { useTaskStore } from '../../store/useTaskStore'

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
 * Key is node id, value is a Set of connected node ids.
 */
type AdjacencyMap = Map<string, Set<string>>

/**
 * @description Props for GoalRelationsGraph (goals + projects only).
 */
export interface GoalRelationsGraphProps {
  goals: Goal[]
  projects: Project[]
  graphEdges: GraphEdge[]
  /**
   * @description Optional callback when user clicks a node.
   * 用于在父组件中，把被点击的 goal / project 选入「创建关系」下拉框。
   */
  onNodeClick?: (payload: { type: 'goal' | 'project'; id: string }) => void
}

/**
 * @description Builds layout nodes/edges for a goal-project graph.
 *
 * - Goals: placed on an inner circle.
 * - Projects: placed around their "primary goal"; projects without a goal
 *   are placed on an outer ring.
 * - Only goal↔project edges参与可视化，其它类型的边被忽略。
 */
function buildLayout(
  goals: Goal[],
  projects: Project[],
  graphEdges: GraphEdge[],
  viewportWidth: number,
  viewportHeight: number,
): {
  nodes: LayoutNode[]
  edges: LayoutEdge[]
  adjacency: AdjacencyMap
} {
  const centerX = 0
  const centerY = 0

  const goalMap = new Map<string, Goal>(goals.map((g) => [g.id, g]))
  const projectMap = new Map<string, Project>(projects.map((p) => [p.id, p]))

  // ---- 仅保留 goal ↔ project 的边 ----
  const goalProjectEdges: GraphEdge[] = []

  for (const edge of graphEdges) {
    const isGoalProjectEdge =
      (edge.fromType === 'goal' && edge.toType === 'project') ||
      (edge.fromType === 'project' && edge.toType === 'goal')

    if (isGoalProjectEdge) {
      goalProjectEdges.push(edge)
    }
  }

  // ---- 计算每个 project 的主 Goal ----
  const primaryGoalByProject = new Map<string, string>()

  // 1）优先采用项目本身的 goalId
  projectMap.forEach((project) => {
    if (project.goalId && goalMap.has(project.goalId)) {
      primaryGoalByProject.set(project.id, project.goalId)
    }
  })

  // 2）再用图中的 goal↔project 边补充
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

  /**
   * @description Registers bidirectional adjacency between two layout node ids.
   */
  const addAdjacency = (a: string, b: string) => {
    if (!adjacency.has(a)) adjacency.set(a, new Set())
    if (!adjacency.has(b)) adjacency.set(b, new Set())
    adjacency.get(a)!.add(b)
    adjacency.get(b)!.add(a)
  }

  // ---- 第 1 步：在逻辑坐标系中布局 Goal / Project ----

  const goalCount = Math.max(goals.length, 1)
  const goalRadius = 80
  const projectBaseRadius = goalRadius + 40

  const goalPositionById = new Map<string, { x: number; y: number; angle: number }>()

  goals.forEach((goal, index) => {
    const angle = (2 * Math.PI * index) / goalCount - Math.PI / 2 // 从顶部开始
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
    })
  })

  // 将有主 Goal 的项目分组，围绕各自 Goal 排布
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
      const ringIndex = Math.floor(index / 5)
      const offsetIndex = index % 5
      const angleSpread = Math.PI / 10
      const effectiveCount = Math.min(count, 5)
      const offset =
        (offsetIndex - (effectiveCount - 1) / 2) *
        (angleSpread / Math.max(effectiveCount, 1))

      const radius = projectBaseRadius + ringIndex * 26
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
      })
    })
  })

  // 没有主 Goal 的孤立项目：放在更外圈
  const orphanProjects: Project[] = []
  projectMap.forEach((project) => {
    if (!primaryGoalByProject.has(project.id)) {
      orphanProjects.push(project)
    }
  })

  if (orphanProjects.length > 0) {
    const radius = projectBaseRadius + 60
    orphanProjects.forEach((project, index) => {
      const angle = (2 * Math.PI * index) / orphanProjects.length + Math.PI / 6
      const x = centerX + radius * Math.cos(angle)
      const y = centerY + radius * Math.sin(angle)
      const nodeId = `project-${project.id}`

      const exists = logicalNodes.some((n) => n.id === nodeId)
      if (exists) return

      logicalNodes.push({
        id: nodeId,
        entityId: project.id,
        label: project.title,
        type: 'project',
        x,
        y,
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

    layoutEdges.push({
      id: `edge-${index}`,
      sourceId: sourceNodeId,
      targetId: targetNodeId,
    })

    addAdjacency(sourceNodeId, targetNodeId)
  })

  if (logicalNodes.length === 0) {
    return { nodes: [], edges: [], adjacency }
  }

  // ---- 第 2 步：Fit-to-viewport（缩放和平移到 SVG 视口） ----

  const padding = 24
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

  const labelMargin = 60
  minX -= labelMargin
  maxX += labelMargin
  minY -= labelMargin
  maxY += labelMargin

  const contentWidth = Math.max(maxX - minX, 1)
  const contentHeight = Math.max(maxY - minY, 1)

  const availableWidth = Math.max(viewportWidth - padding * 2, 1)
  const availableHeight = Math.max(viewportHeight - padding * 2, 1)

  const scale = Math.min(
    availableWidth / contentWidth,
    availableHeight / contentHeight,
    1,
  )

  const contentCenterX = (minX + maxX) / 2
  const contentCenterY = (minY + maxY) / 2

  const viewportCenterX = viewportWidth / 2
  const viewportCenterY = viewportHeight / 2

  const finalNodes: LayoutNode[] = logicalNodes.map((node) => {
    const dx = node.x - contentCenterX
    const dy = node.y - contentCenterY
    const x = dx * scale + viewportCenterX
    const y = dy * scale + viewportCenterY
    return { ...node, x, y }
  })

  return {
    nodes: finalNodes,
    edges: layoutEdges,
    adjacency,
  }
}

/**
 * @description Relationship graph for goals and projects, similar to Obsidian's graph view.
 * Nodes are positioned using a radial layout and then fitted into the viewport;
 * hover highlights neighbors; clicking two different nodes (goal↔project) creates
 * a "supports" relation between them.
 */
export const GoalRelationsGraph: FC<GoalRelationsGraphProps> = ({
  goals,
  projects,
  graphEdges,
  onNodeClick,
}) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  /**
   * @description Currently selected node id for creating a relation by two clicks.
   */
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)

  const addGraphEdge = useTaskStore((state) => state.addGraphEdge)

  const [dimensions, setDimensions] = useState({ width: 800, height: 420 })

  // Observe container size for responsive graph fitting
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        if (width > 0 && height > 0) {
          setDimensions({
            width: Math.max(Math.round(width), 400),
            height: Math.max(Math.round(height), 300),
          })
        }
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const { nodes, edges, adjacency } = useMemo(
    () => buildLayout(goals, projects, graphEdges, dimensions.width, dimensions.height),
    [goals, projects, graphEdges, dimensions.width, dimensions.height],
  )

  const hasData = nodes.length > 0 && edges.length > 0

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden rounded-none bg-transparent">
      <svg
        viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
        className="absolute inset-0 h-full w-full"
        role="img"
        aria-label="Goals and projects relationship graph; hover to inspect, click two nodes to link goal and project."
      >
        {/* Background grid dots for subtle texture */}
        <defs>
          <pattern
            id="graph-dot-pattern"
            x="0"
            y="0"
            width="18"
            height="18"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="1" cy="1" r="1" className="fill-slate-800" />
          </pattern>
        </defs>
        <rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill="url(#graph-dot-pattern)"
        />

        {/* Edges */}
        <g>
          {edges.map((edge) => {
            const source = nodes.find((n) => n.id === edge.sourceId)
            const target = nodes.find((n) => n.id === edge.targetId)
            if (!source || !target) return null

            const isActiveByHover =
              hoveredId != null &&
              (edge.sourceId === hoveredId || edge.targetId === hoveredId)
            const isActiveBySelect =
              selectedNodeId != null &&
              (edge.sourceId === selectedNodeId ||
                edge.targetId === selectedNodeId)
            const isActive = isActiveByHover || isActiveBySelect

            return (
              <line
                key={edge.id}
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                className={
                  isActive
                    ? 'stroke-slate-200 stroke-[1.4] opacity-90'
                    : 'stroke-slate-600 stroke-[0.9] opacity-50'
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
              selectedNodeId != null &&
              adjacency.get(selectedNodeId)?.has(node.id)

            const shouldDimContext =
              hoveredId != null || selectedNodeId != null

            const isDimmed =
              shouldDimContext &&
              !isHovered &&
              !isNeighbor &&
              !isSelected &&
              !isNeighborOfSelected

            const baseRadius = node.type === 'goal' ? 6 : 4
            const isActiveNode = isHovered || isSelected
            const radius = isActiveNode ? baseRadius + 2 : baseRadius

            const fillClass =
              node.type === 'goal'
                ? isActiveNode
                  ? 'fill-sky-300'
                  : 'fill-sky-200'
                : isActiveNode
                ? 'fill-emerald-300'
                : 'fill-emerald-200'

            const strokeClass = isActiveNode
              ? 'stroke-white'
              : node.type === 'goal'
              ? 'stroke-sky-500'
              : 'stroke-emerald-500'

            const labelOffsetX = node.x >= width / 2 ? 8 : -8
            const textAnchor = node.x >= width / 2 ? 'start' : 'end'

            /**
             * @description Handles click on a node:
             * - updates external selection via onNodeClick
             * - first click selects a node; second click on another node (goal↔project)
             *   creates a "supports" edge if not existing, then clears selection.
             */
            const handleClick = () => {
              const payload = {
                type: node.type,
                id: node.entityId,
              }

              // Keep existing external behavior for dropdowns, etc.
              onNodeClick?.(payload)

              // No previous selection: select this node for linking.
              if (selectedNodeId === null) {
                setSelectedNodeId(node.id)
                return
              }

              // Clicking the same node again cancels selection.
              if (selectedNodeId === node.id) {
                setSelectedNodeId(null)
                return
              }

              const selectedNode = nodes.find(
                (n) => n.id === selectedNodeId,
              )
              if (!selectedNode) {
                setSelectedNodeId(node.id)
                return
              }

              const aType = selectedNode.type
              const aId = selectedNode.entityId
              const bType = node.type
              const bId = node.entityId

              // Do not create self-links or same-type links; only goal↔project.
              if ((aType === bType && aId === bId) || aType === bType) {
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
                className="cursor-pointer"
                onMouseEnter={() => setHoveredId(node.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={handleClick}
              >
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={radius}
                  className={`${fillClass} ${strokeClass}`}
                  strokeWidth={1}
                />
                <text
                  x={node.x + labelOffsetX}
                  y={node.y - 8}
                  textAnchor={textAnchor}
                  className={`select-none text-[10px] ${
                    isDimmed ? 'fill-slate-500' : 'fill-slate-100'
                  }`}
                >
                  {node.label}
                </text>
              </g>
            )
          })}
        </g>
      </svg>

      {!hasData && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <p className="rounded-full bg-slate-900/80 px-3 py-1 text-[11px] text-slate-300">
            Link projects to goals above to see the relationship graph.
          </p>
        </div>
      )}
    </div>
  )
}
