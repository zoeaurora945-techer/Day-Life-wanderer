import { Component, type ReactNode } from 'react'
import { t } from '../../i18n/translations'

interface Props {
  children: ReactNode
  label?: string
  lang?: 'zh' | 'en'
}

interface State {
  hasError: boolean
  error?: Error
}

/**
 * @description Isolates a view so a render error in new modules (galaxy/anchor)
 * cannot blank the whole app. Keeps the rest of the tabs usable.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', this.props.label, error, info)
  }

  render() {
    const lang = this.props.lang ?? 'zh'
    if (this.state.hasError) {
      return (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-base text-red-700">
          <p>{this.props.label ?? '这个模块'}</p>
          <p>{t(lang, 'error.galaxy')}</p>
          <p className="mt-1 text-sm text-red-500">{t(lang, 'error.otherwise_fine')}</p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="mt-2 rounded-lg bg-red-100 px-3 py-1.5 text-sm text-red-700 hover:bg-red-200"
          >
            {t(lang, 'error.retry')}
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
