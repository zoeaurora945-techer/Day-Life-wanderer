import { useMemo } from 'react'
import { useTaskStore } from '../../store/useTaskStore'
import { buildGalaxyModel } from '../../shared/derived'

/**
 * @description Multi-galaxy view (MVP: SVG, not Canvas — stable + React-friendly).
 * Each life-direction goal is a glowing star; its projects orbit as planets sized by progress;
 * tasks with no project float as scatter points; cross-galaxy edges are dashed links.
 *
 * @note Canvas optimisation is deferred to the mini-program phase (M6) per docs/02 §10.
 */
const STAR_COLORS = ['#fbbf24', '#a78bfa', '#34d399', '#60a5fa', '#f472b6', '#22d3ee']

export function GalaxyView() {
  const goals = useTaskStore((s) => s.goals)
  const projects = useTaskStore((s) => s.projects)
  const tasks = useTaskStore((s) => s.tasks)
  const edges = useTaskStore((s) => s.graphEdges)

  const model = useMemo(
    () => buildGalaxyModel(goals, projects, tasks, edges),
    [goals, projects, tasks, edges],
  )

  const colorOf = (goalId?: string | null): string => {
    if (!goalId) return STAR_COLORS[0]
    const idx = goals.findIndex((g) => g.id === goalId)
    return STAR_COLORS[((idx % STAR_COLORS.length) + STAR_COLORS.length) % STAR_COLORS.length]
  }

  return (
    <div className="h-full overflow-auto rounded-2xl bg-slate-900 p-4">
      <svg
        width={model.width}
        height={model.height}
        viewBox={`0 0 ${model.width} ${model.height}`}
        className="max-w-none"
      >
        <defs>
          <filter id="galaxy-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* cross-galaxy dashed links */}
        {model.links.map((l, i) => (
          <line
            key={`link-${i}`}
            x1={l.x1}
            y1={l.y1}
            x2={l.x2}
            y2={l.y2}
            stroke="#94a3b8"
            strokeOpacity={0.4}
            strokeWidth={1}
            strokeDasharray="4 4"
          />
        ))}

        {/* scatter points (tasks without a project) */}
        {model.scatter.map((s, i) => (
          <circle key={`sc-${i}`} cx={s.cx} cy={s.cy} r={3} fill="#cbd5e1" fillOpacity={0.6} />
        ))}

        {/* planets (projects) */}
        {model.planets.map((p, i) => {
          const color = colorOf(p.goalId)
          const r = 7 + p.progress * 9
          return (
            <g key={`pl-${i}`}>
              <circle cx={p.cx} cy={p.cy} r={r} fill={color} fillOpacity={0.85} />
              <text
                x={p.cx}
                y={p.cy + r + 13}
                textAnchor="middle"
                fontSize={11}
                fill="#e2e8f0"
              >
                {p.project.title}
              </text>
            </g>
          )
        })}

        {/* stars (goals) */}
        {model.stars.map((s, i) => {
          const color = colorOf(s.goal.id)
          return (
            <g key={`st-${i}`}>
              <circle cx={s.cx} cy={s.cy} r={26} fill={color} filter="url(#galaxy-glow)" />
              <circle cx={s.cx} cy={s.cy} r={13} fill="#ffffff" fillOpacity={0.92} />
              <text
                x={s.cx}
                y={s.cy + 48}
                textAnchor="middle"
                fontSize={14}
                fontWeight={600}
                fill="#f8fafc"
              >
                {s.goal.title}
              </text>
            </g>
          )
        })}
      </svg>

      {model.stars.length === 0 && (
        <div className="p-8 text-center text-sm text-slate-400">
          还没有人生主线星系，去「主线」页添加你的第一个目标吧 ✨
        </div>
      )}
    </div>
  )
}
