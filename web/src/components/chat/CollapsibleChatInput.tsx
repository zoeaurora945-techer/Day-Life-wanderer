/**
 * @file CollapsibleChatInput component.
 * @description A compact, collapsible input bar for the task tab.
 * - Collapsed: single-line bar with placeholder, click to expand
 * - Expanded: full textarea + send button
 * - After submit, shows a slim preview of the latest daily log
 */
import { useState, useRef, useEffect } from 'react'
import { useTaskStore } from '../../store/useTaskStore'
import { t, type Language } from '../../i18n/translations'
import { Plus, Sparkles, Send, MessageSquare } from 'lucide-react'
import { useMemo } from 'react'

interface CollapsibleChatInputProps {
  lang: Language
}

export function CollapsibleChatInput({ lang }: CollapsibleChatInputProps) {
  const addDailyLog = useTaskStore((s) => s.addDailyLog)
  const logs = useTaskStore((s) => s.dailyLogs)

  const [expanded, setExpanded] = useState(false)
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    if (expanded && textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }
  }, [expanded, text])

  // Focus textarea when expanded
  useEffect(() => {
    if (expanded) {
      textareaRef.current?.focus()
    }
  }, [expanded])

  const submit = () => {
    const v = text.trim()
    if (!v) return
    addDailyLog(v)
    setText('')
    setExpanded(false)
  }

  const latestLog = useMemo(() => {
    const sorted = [...logs].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return sorted[0] ?? null
  }, [logs])

  return (
    <div className="flex flex-col gap-1.5">
      {/* Main input area */}
      {expanded ? (
        <div className="rounded-xl border border-indigo-200 bg-white p-3 shadow-sm">
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-indigo-600">
            <Sparkles className="h-3.5 w-3.5" />
            {t(lang, 'anchor.title')}
          </div>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                submit()
              }
              if (e.key === 'Escape') {
                setExpanded(false)
                setText('')
              }
            }}
            rows={2}
            placeholder={t(lang, 'anchor.placeholder')}
            className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:bg-white"
          />
          <div className="mt-1.5 flex items-center justify-between">
            <span className="text-[10px] text-slate-400">{t(lang, 'anchor.send_hint')}</span>
            <button
              type="button"
              onClick={submit}
              disabled={!text.trim()}
              className="inline-flex items-center gap-1 rounded-full bg-indigo-600 px-3 py-1 text-xs font-medium text-white transition disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <Send className="h-3 w-3" />
              {t(lang, 'anchor.parse_btn')}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-400 shadow-sm transition hover:border-indigo-300 hover:bg-white hover:text-slate-500"
        >
          <Plus className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">{t(lang, 'anchor.title')}</span>
          <Sparkles className="h-4 w-4 shrink-0 text-indigo-400" />
        </button>
      )}

      {/* Latest log preview (only when not expanded and there's a recent log) */}
      {!expanded && latestLog ? (
        <div className="flex items-start gap-2 rounded-lg border border-slate-100 bg-slate-50/50 px-2.5 py-1.5">
          <MessageSquare className="mt-0.5 h-3 w-3 shrink-0 text-slate-400" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-slate-600">{latestLog.userText}</p>
          </div>
        </div>
      ) : null}
    </div>
  )
}
