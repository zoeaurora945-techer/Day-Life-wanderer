/**
 * @file i18n support for bilingual (Chinese/English) UI.
 * @description Simple translation system for the anchor app.
 */

export type Language = 'zh' | 'en'

export const translations: Record<Language, Record<string, string>> = {
  zh: {
    // Header
    'header.weekday': (d: number) => ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d] ?? '',
    'header.week': 'Week',
    'header.progress': (w: number, t: number) => `${w}/${t}`,
    'header.new_task': '新建任务',

    // Tabs
    'tab.board': '任务',
    'tab.week': '周',
    'tab.overall': '主线',
    'tab.anchor': '锚点',
    'tab.galaxy': '星系',

    // Board mode switch
    'board.quadrant': '四象限',
    'board.list': '全部清单',

    // Error messages
    'error.galaxy': '星系模块加载出错',
    'error.retry': '重试',
    'error.loading': '加载中...',
    'error.otherwise_fine': '但其他功能不受影响。刷新页面再试试～',

    // Galaxy empty state
    'galaxy.empty': '还没有人生主线，去「主线」页添加你的第一个目标吧 ✨',

    // Language
    'lang.zh': '中文',
    'lang.en': 'English',
  },
  en: {
    // Header
    'header.weekday': (d: number) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d] ?? '',
    'header.week': 'Week',
    'header.progress': (w: number, t: number) => `${w}/${t}`,
    'header.new_task': 'New task',

    // Tabs
    'tab.board': 'Tasks',
    'tab.week': 'Week',
    'tab.overall': 'Overall',
    'tab.anchor': 'Anchor',
    'tab.galaxy': 'Galaxy',

    // Board mode switch
    'board.quadrant': 'Quadrant',
    'board.list': 'All Tasks',

    // Error messages
    'error.galaxy': 'Galaxy module error',
    'error.retry': 'Retry',
    'error.loading': 'Loading...',
    'error.otherwise_fine': 'but other features are fine. Try refreshing～',

    // Galaxy empty state
    'galaxy.empty': 'No life goals yet. Add your first goal in the "Overall" tab ✨',

    // Language
    'lang.zh': '中文',
    'lang.en': 'English',
  },
}

export function t(lang: Language, key: string, ...args: any[]): string {
  const template = translations[lang]?.[key] ?? translations['zh']?.[key] ?? key
  if (typeof template === 'function') {
    return template(...args)
  }
  return template
}
