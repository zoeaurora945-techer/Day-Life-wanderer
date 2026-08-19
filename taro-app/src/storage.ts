/**
 * @file Cross-platform storage adapter for Taro.
 * @description Wraps Taro's storage API so the store works identically in WeChat Mini Program and H5.
 * Replaces the Web version's window.localStorage dependency.
 */

import Taro from '@tarojs/taro'

export const STORAGE_KEY = 'quadrant-task-app-state-v1'

export function loadState<T>(): T | null {
  try {
    const raw = Taro.getStorageSync(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function saveState<T>(state: T): void {
  try {
    Taro.setStorageSync(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Swallow persistence errors to avoid breaking UI.
  }
}
