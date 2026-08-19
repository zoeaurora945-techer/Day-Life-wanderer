/**
 * @file categoryStyles utility.
 * @description Shared pastel (macaron) color classes for task categories to keep UI consistent across modules.
 */

import type { Category } from '../types/task'

/**
 * @description Returns Tailwind classes for a card-style surface (border + background)
 * using a soft pastel palette per category.
 */
export function getCategoryCardClasses(category: Category): string {
  switch (category) {
    case 'research':
      // Lavender tone
      return 'border-violet-200 bg-violet-50'
    case 'work':
      // Soft sky blue
      return 'border-sky-200 bg-sky-50'
    case 'life':
      // Mint / light green
      return 'border-emerald-200 bg-emerald-50'
    default:
      return 'border-slate-200 bg-slate-50'
  }
}

/**
 * @description Returns Tailwind classes for a small pill label for the category,
 * including border, background and text color.
 */
export function getCategoryPillClasses(category: Category): string {
  switch (category) {
    case 'research':
      return 'border-violet-200 bg-violet-50 text-violet-800'
    case 'work':
      return 'border-sky-200 bg-sky-50 text-sky-800'
    case 'life':
      return 'border-emerald-200 bg-emerald-50 text-emerald-800'
    default:
      return 'border-slate-200 bg-slate-50 text-slate-800'
  }
}