/**
 * @file AccessGate component.
 * @description Simple invite-code gate: asks for an invite code once, then unlocks the app in this browser.
 */

import type { FC, FormEvent, ReactNode } from 'react'
import { useEffect, useState } from 'react'

/**
 * @description Props for AccessGate.
 */
export interface AccessGateProps {
  children: ReactNode
}

/**
 * @description Single invite code used to unlock the app.
 * TODO: change this to your own secret code before building/deploying.
 */
const INVITE_CODE = 'my-secret-code-1234'

/**
 * @description LocalStorage key used to remember access in this browser.
 */
const STORAGE_KEY = 'quadrant_helper_access_granted'

/**
 * @description Wraps the whole app and shows an invite-code screen until the correct code is entered.
 */
export const AccessGate: FC<AccessGateProps> = ({ children }) => {
  const [hasAccess, setHasAccess] = useState<boolean | null>(null)
  const [codeInput, setCodeInput] = useState('')
  const [error, setError] = useState<string | null>(null)

  // On mount, check whether access was already granted in this browser.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      setHasAccess(stored === '1')
    } catch {
      // If localStorage is unavailable, fall back to requiring code every time.
      setHasAccess(false)
    }
  }, [])

  /**
   * @description Handles invite-code form submission.
   */
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const trimmed = codeInput.trim()
    if (!trimmed) {
      setError('请输入邀请码')
      return
    }
    if (trimmed !== INVITE_CODE) {
      setError('邀请码错误，请确认后再试')
      return
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      // Ignore storage errors; access is still granted for this session.
    }
    setHasAccess(true)
  }

  if (hasAccess === null) {
    // Initial loading state while checking localStorage
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="rounded-xl bg-slate-900 px-6 py-4 shadow-lg">
          <p className="text-xs text-slate-300">Loading…</p>
        </div>
      </div>
    )
  }

  if (!hasAccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="w-full max-w-sm rounded-2xl bg-slate-900 px-6 py-6 shadow-2xl ring-1 ring-slate-700/60">
          <h1 className="mb-1 text-lg font-semibold text-slate-50">
            Quadrant Goal Helper
          </h1>
          <p className="mb-4 text-xs text-slate-400">
            这是一个私人网站，仅限被邀请的朋友访问。请输入邀请码继续。
          </p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1">
              <label className="block text-[11px] font-medium text-slate-200">
                邀请码
              </label>
              <input
                type="password"
                className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm text-slate-50 outline-none placeholder:text-slate-500 focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
                value={codeInput}
                onChange={(e) => {
                  setCodeInput(e.target.value)
                  if (error) setError(null)
                }}
                placeholder="请输入你获得的邀请码"
              />
              {error ? (
                <p className="text-[11px] text-rose-400">{error}</p>
              ) : null}
            </div>

            <button
              type="submit"
              className="flex w-full items-center justify-center rounded-md bg-sky-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-sky-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
            >
              进入网站
            </button>
          </form>

          <p className="mt-3 text-[10px] leading-relaxed text-slate-500">
            如果你还没有邀请码，请联系站点所有者获取。为了保护你的隐私，本网站不会收集账号信息，只通过邀请码控制访问。
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}