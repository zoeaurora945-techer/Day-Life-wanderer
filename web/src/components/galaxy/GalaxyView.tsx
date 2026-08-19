import { useMemo, useState, useEffect, useRef } from 'react'
import { useTaskStore } from '../../store/useTaskStore'
import { buildGalaxyModel } from '../../shared/derived'

/**
 * @description Galaxy view — a cosmic visualisation:
 * - goals → glowing STARS (恒星), planets → PROJECTS (小行星) orbiting their star,
 *   tasks → MOONS (卫星) around projects or drifting stardust.
 * Center-radial layout (everything extends from the viewport centre), with a deep
 * blue space background, nebula clouds, floating animation and random stable colors.
 */
export function GalaxyView() {
  const goals = useTaskStore((s) => s.goals)
  const projects = useTaskStore((s) => s.projects)
  const tasks = useTaskStore((s) => s.tasks)
  const edges = useTaskStore((s) => s.graphEdges)

  const [dimensions, setDimensions] = useState({ width: 900, height: 640 })
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        if (width > 0 && height > 0) {
          setDimensions({
            width: Math.max(Math.round(width), 800),
            height: Math.max(Math.round(height), 560),
          })
        }
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const model = useMemo(
    () => buildGalaxyModel(goals, projects, tasks, edges, dimensions.width, dimensions.height),
    [goals, projects, tasks, edges, dimensions.width, dimensions.height],
  )

  const starPos = useMemo(
    () => new Map(model.stars.map((s) => [s.goal.id, s])),
    [model.stars],
  )
  const planetPos = useMemo(
    () => new Map(model.planets.map((p) => [p.project.id, p])),
    [model.planets],
  )

  return (
    <div
      ref={containerRef}
      className="h-full w-full overflow-auto rounded-2xl"
      style={{ background: '#03070f' }}
    >
      <svg
        viewBox={`0 0 ${model.width} ${model.height}`}
        className="block h-full w-full"
        role="img"
        aria-label="Galaxy view of goals, projects and tasks"
      >
        <defs>
          <radialGradient id="gx-space" cx="50%" cy="42%" r="78%">
            <stop offset="0%" stopColor="#0b1b33" />
            <stop offset="60%" stopColor="#061325" />
            <stop offset="100%" stopColor="#02060f" />
          </radialGradient>
          <radialGradient id="gx-neb1" cx="32%" cy="28%" r="42%">
            <stop offset="0%" stopColor="#5b8cff" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#5b8cff" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="gx-neb2" cx="72%" cy="72%" r="46%">
            <stop offset="0%" stopColor="#a855f7" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
          </radialGradient>
          <filter id="gx-glow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="9" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <style>{`
            .gx-float { transform-box: fill-box; transform-origin: center; animation: gxF 7s ease-in-out infinite; }
            @keyframes gxF { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-7px); } }
          `}</style>
        </defs>

        {/* Background */}
        <rect x={0} y={0} width={model.width} height={model.height} fill="url(#gx-space)" />
        <ellipse
          cx={model.width * 0.3}
          cy={model.height * 0.28}
          rx={model.width * 0.36}
          ry={model.height * 0.32}
          fill="url(#gx-neb1)"
        />
        <ellipse
          cx={model.width * 0.74}
          cy={model.height * 0.74}
          rx={model.width * 0.3}
          ry={model.height * 0.28}
          fill="url(#gx-neb2)"
        />

        {/* Background stardust */}
        {model.dust.map((d, i) => (
          <circle key={`d-${i}`} cx={d.x} cy={d.y} r={d.r} fill="#cbd5e1" opacity={d.o} />
        ))}

        {/* Star → Planet links */}
        {model.planets.map((p) => {
          const star = p.goalId ? starPos.get(p.goalId) : null
          if (!star) return null
          return (
            <line
              key={`lp-${p.project.id}`}
              x1={star.cx}
              y1={star.cy}
              x2={p.cx}
              y2={p.cy}
              stroke={p.color}
              strokeOpacity={0.35}
              strokeWidth={1}
            />
          )
        })}

        {/* Planet → Moon links */}
        {model.moons
          .filter((m) => m.projectId)
          .map((m) => {
            const pl = planetPos.get(m.projectId as string)
            if (!pl) return null
            return (
              <line
                key={`lm-${m.task.id}`}
                x1={pl.cx}
                y1={pl.cy}
                x2={m.cx}
                y2={m.cy}
                stroke="#94a3b8"
                strokeOpacity={0.22}
                strokeWidth={0.6}
              />
            )
          })}

        {/* Moons (tasks) */}
        {model.moons.map((m) => (
          <g key={`m-${m.task.id}`} transform={`translate(${m.cx},${m.cy})`}>
            <g className="gx-float" style={{ animationDelay: `${(m.index % 8) * 0.4}s` }}>
              <circle r={2.6} fill="#e2e8f0" opacity={0.85} />
            </g>
          </g>
        ))}

        {/* Planets (projects) */}
        {model.planets.map((p) => {
          const r = 6 + p.progress * 9
          return (
            <g key={`p-${p.project.id}`} transform={`translate(${p.cx},${p.cy})`}>
              <g className="gx-float" style={{ animationDelay: `${(p.index % 8) * 0.5}s` }}>
                <circle r={r} fill={p.color} opacity={0.9} />
                <text
                  y={r + 13}
                  textAnchor="middle"
                  fontSize={11}
                  fill="#e2e8f0"
                >
                  {p.project.title}
                </text>
              </g>
            </g>
          )
        })}

        {/* Stars (goals) */}
        {model.stars.map((s) => (
          <g key={`s-${s.goal.id}`} transform={`translate(${s.cx},${s.cy})`}>
            <g className="gx-float" style={{ animationDelay: `${(s.index % 8) * 0.6}s` }}>
              <circle r={26} fill={s.color} filter="url(#gx-glow)" />
              <circle r={13} fill="#ffffff" opacity={0.95} />
              <text
                y={46}
                textAnchor="middle"
                fontSize={14}
                fontWeight={600}
                fill="#f8fafc"
              >
                {s.goal.title}
              </text>
            </g>
          </g>
        ))}
      </svg>

      {model.stars.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <p className="rounded-full bg-slate-900/80 px-3 py-1 text-xs text-slate-300">
            还没有人生主线，去「主线」页添加你的第一个目标吧 ✨
          </p>
        </div>
      )}
    </div>
  )
}
