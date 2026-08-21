import { useMemo, useState, useEffect, useRef } from 'react'
import { useTaskStore } from '../../store/useTaskStore'
import { buildGalaxyModel, getProjectTaskIds } from '../../shared/derived'
import { t } from '../../i18n/translations'
import type { Project, Task, GraphEdge } from '../../types/task'

const DAY = 86400000

/**
 * @description 计算某 goal 子树的"活跃度" (0-1)，用于恒星亮度时间演化。
 * 7 天内满亮，60 天后衰减到最低 0.2；无活动数据默认 0.65。
 */
function goalActivityLevel(
  goalId: string,
  projects: Project[],
  tasks: Task[],
  edges: GraphEdge[],
  lastActiveAt?: string,
): number {
  let latest = lastActiveAt ? Date.parse(lastActiveAt) : NaN
  const sub = projects.filter((p) => p.goalId === goalId && p.status !== 'archived')
  for (const p of sub) {
    if (p.lastActiveAt) latest = Math.max(latest, Date.parse(p.lastActiveAt))
    const ids = getProjectTaskIds(p.id, edges)
    for (const tk of tasks) {
      if (!ids.includes(tk.id)) continue
      const tt = tk.doneAt ? Date.parse(tk.doneAt) : Date.parse(tk.createdAt)
      if (!isNaN(tt)) latest = Math.max(latest, tt)
    }
  }
  if (isNaN(latest)) return 0.65
  const d = (Date.now() - latest) / DAY
  return Math.max(0.2, Math.min(1, 1 - Math.max(0, d - 7) / 53))
}

interface PlanetStyle {
  fill: string
  opacity: number
  ring?: string
  ringW?: number
  symbol: string
}

/** 行星按 status 呈现不同"时间演化"形态。 */
function planetStyle(status?: string): PlanetStyle {
  switch (status) {
    case 'paused':
      // 冰封行星：冷淡蓝、半透明、霜环
      return { fill: '#7dd3fc', opacity: 0.7, ring: '#e0f2fe', ringW: 2, symbol: '⏸' }
    case 'completed':
      // 圆满行星：暖金、光环
      return { fill: '#fde68a', opacity: 1, ring: '#fffbeb', ringW: 2.5, symbol: '★' }
    default:
      // 活跃行星：沿用星系配色
      return { fill: '', opacity: 0.9, symbol: '' }
  }
}

/**
 * @description Galaxy view — a cosmic visualisation:
 * - goals → glowing STARS (恒星), planets → PROJECTS orbiting their star,
 *   tasks → MOONS (卫星) around projects or drifting stardust.
 * - Time evolution: star brightness = subtree activity; planets show
 *   paused(frozen)/completed(fulfilled) forms; moons show doing/todo states.
 * - Focus mode: click a star to zoom into its single-galaxy system.
 */
export function GalaxyView() {
  const goals = useTaskStore((s) => s.goals)
  const projects = useTaskStore((s) => s.projects)
  const tasks = useTaskStore((s) => s.tasks)
  const edges = useTaskStore((s) => s.graphEdges)
  const { lang } = useTaskStore((s) => s)

  const [dimensions, setDimensions] = useState({ width: 900, height: 640 })
  const containerRef = useRef<HTMLDivElement>(null)
  const [hasError, setHasError] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [focusGoalId, setFocusGoalId] = useState<string | null>(null)

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

  // Only focus when the goal actually exists and is not archived.
  const safeFocus =
    focusGoalId && goals.some((g) => g.id === focusGoalId && g.status !== 'archived')
      ? focusGoalId
      : null

  // Build model with error handling
  const model = useMemo(() => {
    try {
      return buildGalaxyModel(
        goals,
        projects,
        tasks,
        edges,
        dimensions.width,
        dimensions.height,
        safeFocus,
      )
    } catch (err) {
      console.error('[GalaxyView] buildGalaxyModel error:', err)
      setHasError(true)
      setErrorMessage(err instanceof Error ? err.message : 'Unknown error')
      return null
    }
  }, [goals, projects, tasks, edges, dimensions.width, dimensions.height, safeFocus])

  if (hasError) {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl bg-red-50 p-6">
        <div className="text-center">
          <p className="text-base font-medium text-red-700">{t(lang, 'error.galaxy')}</p>
          <p className="mt-2 text-sm text-red-500">{errorMessage}</p>
          <button
            onClick={() => setHasError(false)}
            className="mt-4 rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            {t(lang, 'error.retry')}
          </button>
        </div>
      </div>
    )
  }

  if (!model) {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl bg-slate-50">
        <p className="text-base text-slate-500">{t(lang, 'error.loading')}</p>
      </div>
    )
  }

  const starPos = useMemo(
    () => new Map(model.stars.map((s) => [s.goal.id, s])),
    [model.stars],
  )
  const planetPos = useMemo(
    () => new Map(model.planets.map((p) => [p.project.id, p])),
    [model.planets],
  )

  const focusStats = useMemo(() => {
    if (!safeFocus) return null
    const ps = model.planets
    const avg = ps.length ? ps.reduce((a, p) => a + p.progress, 0) / ps.length : 0
    return { count: ps.length, progress: Math.round(avg * 100) }
  }, [safeFocus, model])

  const focusedTitle = safeFocus ? model.stars[0]?.goal.title ?? '' : ''

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-auto rounded-2xl"
      style={{ background: '#03070f' }}
    >
      <svg
        key={safeFocus ?? 'all'}
        viewBox={`0 0 ${model.width} ${model.height}`}
        className="gx-in block h-full w-full"
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
            .gx-in { animation: gxIn .45s ease both; }
            @keyframes gxIn { from { opacity: 0; } to { opacity: 1; } }
          `}</style>
        </defs>

        {/* Background — click empty space to exit focus */}
        <rect
          x={0}
          y={0}
          width={model.width}
          height={model.height}
          fill="url(#gx-space)"
          onClick={() => setFocusGoalId(null)}
          style={{ cursor: safeFocus ? 'zoom-out' : 'default' }}
        />
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

        {/* Moons (tasks) — doing brighter, todo dimmer */}
        {model.moons.map((m) => {
          const doing = m.task.status === 'doing'
          const r = doing ? 3 : 2.2
          const op = doing ? 1 : 0.5
          const fill = doing ? '#fef9c3' : '#cbd5e1'
          return (
            <g key={`m-${m.task.id}`} transform={`translate(${m.cx},${m.cy})`}>
              <g className="gx-float" style={{ animationDelay: `${(m.index % 8) * 0.4}s` }}>
                <circle r={r} fill={fill} opacity={op} />
              </g>
            </g>
          )
        })}

        {/* Planets (projects) — time-evolution forms */}
        {model.planets.map((p) => {
          const r = 6 + p.progress * 9
          const st = planetStyle(p.project.status)
          const fill = st.fill || p.color
          return (
            <g key={`p-${p.project.id}`} transform={`translate(${p.cx},${p.cy})`}>
              <g
                className="gx-float"
                style={{ animationDelay: `${(p.index % 8) * 0.5}s` }}
                onClick={(e) => e.stopPropagation()}
              >
                {st.ring && (
                  <circle r={r + 3.5} fill="none" stroke={st.ring} strokeWidth={st.ringW} opacity={0.7} />
                )}
                <circle
                  r={r}
                  fill={fill}
                  opacity={st.opacity}
                  filter={st.fill ? 'url(#gx-glow)' : undefined}
                />
                <text y={r + 13} textAnchor="middle" fontSize={11} fill="#e2e8f0">
                  {p.project.title}
                  {st.symbol ? ` ${st.symbol}` : ''}
                </text>
              </g>
            </g>
          )
        })}

        {/* Stars (goals) — brightness = activity */}
        {model.stars.map((s) => {
          const lvl = goalActivityLevel(s.goal.id, projects, tasks, edges, s.goal.lastActiveAt)
          const r = 18 + lvl * 16
          const op = 0.55 + lvl * 0.45
          const glowOp = 0.4 + lvl * 0.6
          return (
            <g
              key={`s-${s.goal.id}`}
              transform={`translate(${s.cx},${s.cy})`}
              style={{ cursor: safeFocus ? 'default' : 'pointer' }}
              onClick={(e) => {
                e.stopPropagation()
                if (!safeFocus) setFocusGoalId(s.goal.id)
              }}
            >
              {/* enlarged hit area */}
              <circle r={r + 16} fill="transparent" />
              <circle r={r} fill={s.color} opacity={op} filter="url(#gx-glow)" />
              <circle r={r * 0.5} fill="#ffffff" opacity={0.95 * op} />
              <text y={r + 20} textAnchor="middle" fontSize={14} fontWeight={600} fill="#f8fafc">
                {s.goal.title}
              </text>
              {safeFocus && (
                <text y={r + 36} textAnchor="middle" fontSize={10} fill="#94a3b8">
                  活跃度 {Math.round(lvl * 100)}%
                </text>
              )}
            </g>
          )
        })}
      </svg>

      {/* Focus bar */}
      {safeFocus && focusStats && (
        <div className="absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-3 rounded-full bg-slate-900/85 px-4 py-2 text-xs text-slate-100 ring-1 ring-white/10 backdrop-blur">
          <span className="font-semibold">
            {t(lang, 'galaxy.focusing')} {focusedTitle}
          </span>
          <span className="text-slate-300">
            {t(lang, 'galaxy.stat_projects')} {focusStats.count} · {t(lang, 'galaxy.stat_progress')}{' '}
            {focusStats.progress}%
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setFocusGoalId(null)
            }}
            className="rounded-full bg-white/10 px-3 py-1 font-medium text-white hover:bg-white/20"
          >
            {t(lang, 'galaxy.exit_focus')}
          </button>
        </div>
      )}

      {/* Focus hint (overview only) */}
      {!safeFocus && model.stars.length > 0 && (
        <div className="absolute left-4 top-4 rounded-full bg-slate-900/80 px-4 py-2 text-xs text-slate-300 ring-1 ring-white/10 backdrop-blur">
          {t(lang, 'galaxy.focus_hint')}
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 right-4 w-56 rounded-xl bg-slate-900/85 px-4 py-3 text-xs text-slate-200 shadow-lg ring-1 ring-white/10 backdrop-blur">
        <div className="mb-2 font-semibold text-slate-100">{t(lang, 'galaxy.legend_title')}</div>
        <div className="mb-1 flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full" style={{ background: '#7dd3fc' }} />
          {t(lang, 'galaxy.legend_paused')}
        </div>
        <div className="mb-1 flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full" style={{ background: '#fde68a' }} />
          {t(lang, 'galaxy.legend_completed')}
        </div>
        <div className="mb-1 flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full" style={{ background: '#94a3b8' }} />
          {t(lang, 'galaxy.legend_free')}
        </div>
        <div className="mt-2 border-t border-white/10 pt-2 text-[11px] leading-relaxed text-slate-400">
          {t(lang, 'galaxy.legend_star')}
        </div>
      </div>

      {model.stars.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <p className="rounded-full bg-slate-900/80 px-6 py-3 text-base text-slate-300">
            {t(lang, 'galaxy.empty')}
          </p>
        </div>
      )}
    </div>
  )
}
