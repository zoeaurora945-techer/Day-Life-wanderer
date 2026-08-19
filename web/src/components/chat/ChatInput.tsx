import { useState } from 'react'
import { useTaskStore } from '../../store/useTaskStore'
import { Send, Sparkles } from 'lucide-react'

/**
 * @description Chat input — the primary "每天说一句" entry point.
 * Submits raw text to the store, which runs the rule parser and creates tasks.
 */
export function ChatInput() {
  const addDailyLog = useTaskStore((s) => s.addDailyLog)
  const [text, setText] = useState('')

  const submit = () => {
    const v = text.trim()
    if (!v) return
    addDailyLog(v)
    setText('')
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
        <Sparkles className="h-4 w-4 text-indigo-500" />
        每天说一句
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault()
            submit()
          }
        }}
        rows={3}
        placeholder="例如：明天上午10点交论文初稿，周五前约朋友吃饭，这周要把简历改完"
        className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:bg-white"
      />
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-slate-400">⌘ / Ctrl + Enter 发送</span>
        <button
          type="button"
          onClick={submit}
          disabled={!text.trim()}
          className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          <Send className="h-3.5 w-3.5" />
          拆解
        </button>
      </div>
    </div>
  )
}
