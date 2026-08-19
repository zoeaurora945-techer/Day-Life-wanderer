/**
 * @file Rule-based input parser (锚点小程序 MVP).
 * @description Parses a free-form "每天说一句" text into structured tasks.
 * Pure, dependency-free, runs fully client-side. This is the AI降级 (fallback)
 * implementation used when no LLM key / network is available.
 *
 * @see docs/02-开发技术文档.md §5.3 / §6 (AI_MODE='rule')
 */

import type { Category, Goal, Importance, Project } from '../../types/task'

/**
 * @description A single task extracted from user text.
 */
export interface ParsedTask {
  title: string
  importance: Importance
  category: Category
  dueAt: string // ISO datetime, rounded later by store
  servesGoal: boolean
  projectId: string | null
  notes?: string
}

/**
 * @description Result of parsing a log entry.
 */
export interface ParseResult {
  tasks: ParsedTask[]
  /** True when the text carried no actionable items (pure reflection / mood). */
  reflective: boolean
}

export interface ParseContext {
  projects: Project[]
  goals: Goal[]
  tasks?: unknown[]
}

const IMPORTANCE_WORDS = ['重要', '必须', '务必', '关键', '紧急', '立马', '马上', '尽快', 'deadline', '截止', '一定']
const ANCHOR_WORDS = ['主线', '锚点', '人生', '方向', '归属', '我的目标', '长远', '愿景']
const WORK_WORDS = ['工作', '项目', '开会', '汇报', '客户', '公司', '老板', '周报', '报销', '述职', '面试']
const RESEARCH_WORDS = ['论文', '实验', '文献', '课题', '科研', '数据', '写作', '投稿', '组会', '综述', '课题']
const LIFE_WORDS = ['生活', '健身', '跑步', '读书', '家人', '朋友', '做饭', '打扫', '旅行', '休息', '睡觉', '体检', '运动']

const WEEKDAY_MAP: Record<string, number> = {
  周一: 1, 星期二: 1, 周一: 1, 礼拜一: 1,
  周二: 2, 星期二: 2, 礼拜二: 2,
  周三: 3, 星期三: 3, 礼拜三: 3,
  周四: 4, 星期四: 4, 礼拜四: 4,
  周五: 5, 星期五: 5, 礼拜五: 5,
  周六: 6, 星期六: 6, 礼拜六: 6,
  周日: 0, 周天: 0, 星期日: 0, 星期天: 0, 礼拜天: 0, 礼拜日: 0,
}

/**
 * @description Apply an HH:MM mentioned in text to a base date; default 09:00 if none.
 */
function withTime(base: Date, text: string): string {
  const m = text.match(/(\d{1,2})\s*[:点：]?\s*(\d{2})?\s*(上午|早上|下午|晚上|中午)?/)
  if (m) {
    let h = parseInt(m[1], 10)
    const min = m[2] ? parseInt(m[2], 10) : 0
    const period = m[3]
    if (period === '下午' || period === '晚上') {
      if (h < 12) h += 12
    } else if (period === '中午') {
      h = 12
    } else if ((period === '上午' || period === '早上') && h === 12) {
      h = 0
    }
    const d = new Date(base)
    d.setHours(h, min, 0, 0)
    // If the resulting time is in the past, assume tomorrow.
    if (d.getTime() < Date.now()) {
      d.setDate(d.getDate() + 1)
    }
    return d.toISOString()
  }
  const d = new Date(base)
  d.setHours(9, 0, 0, 0)
  return d.toISOString()
}

/**
 * @description Find the next upcoming weekday (0=Sun..6=Sat) from now.
 */
function nextWeekday(now: Date, target: number): Date {
  const d = new Date(now)
  const cur = d.getDay()
  let delta = (target - cur + 7) % 7
  if (delta === 0) delta = 7 // next week, not today
  d.setDate(d.getDate() + delta)
  return d
}

/**
 * @description Extract a due datetime from a sentence using common Chinese time cues.
 */
function parseDueAt(text: string): string {
  const now = new Date()

  if (/今天|今日|现在|立刻|立马|马上|稍后/.test(text)) {
    return withTime(now, text)
  }
  if (/明天|明日/.test(text)) {
    const d = new Date(now)
    d.setDate(d.getDate() + 1)
    return withTime(d, text)
  }
  if (/后天/.test(text)) {
    const d = new Date(now)
    d.setDate(d.getDate() + 2)
    return withTime(d, text)
  }
  for (const key of Object.keys(WEEKDAY_MAP)) {
    if (text.includes(key)) {
      const d = nextWeekday(now, WEEKDAY_MAP[key])
      return withTime(d, text)
    }
  }
  // Bare "3点" / "15:00" pattern (no explicit day) → today or tomorrow if passed.
  if (/(\d{1,2})\s*[:点：]/.test(text)) {
    return withTime(now, text)
  }
  // No explicit time → default to now (kept simple for MVP; daily rollover handles overdue).
  return now.toISOString()
}

/**
 * @description Match a sentence to an existing project by title overlap.
 * Returns the best project id, or null.
 */
function matchProject(text: string, projects: Project[]): string | null {
  const lower = text.toLowerCase()
  let best: string | null = null
  let bestScore = 0
  for (const p of projects) {
    const title = (p.title || '').toLowerCase()
    if (!title) continue
    if (lower.includes(title)) return p.id // strong full-match
    const words = title.split(/[\s/、，,]+/).filter((w) => w.length >= 2)
    if (words.length === 0) continue
    let hit = 0
    for (const w of words) {
      if (lower.includes(w)) hit += 1
    }
    const ratio = hit / words.length
    if (ratio >= 0.5 && ratio > bestScore) {
      bestScore = ratio
      best = p.id
    }
  }
  return best
}

/**
 * @description Parse free-form user text into structured tasks.
 * Splits on newlines / periods / semicolons; keeps commas inside one task title.
 */
export function parseInput(text: string, ctx: ParseContext): ParseResult {
  const trimmed = (text || '').trim()
  if (!trimmed) return { tasks: [], reflective: true }

  const segments = trimmed
    .split(/[\n。；;！!?？]+/)
    .map((s) => s.trim())
    .filter(Boolean)

  if (segments.length === 0) return { tasks: [], reflective: true }

  const tasks: ParsedTask[] = []
  let anyReflective = false

  for (const seg of segments) {
    if (seg.length < 2) {
      anyReflective = true
      continue
    }
    const importance: Importance = IMPORTANCE_WORDS.some((w) => seg.includes(w))
      ? 'important'
      : 'not_important'
    const servesGoal = ANCHOR_WORDS.some((w) => seg.includes(w))

    let category: Category = 'work'
    if (RESEARCH_WORDS.some((w) => seg.includes(w))) category = 'research'
    else if (LIFE_WORDS.some((w) => seg.includes(w))) category = 'life'

    const dueAt = parseDueAt(seg)
    const projectId = matchProject(seg, ctx.projects)

    tasks.push({ title: seg, importance, category, dueAt, servesGoal, projectId })
  }

  return {
    tasks,
    reflective: tasks.length === 0 ? true : anyReflective,
  }
}
