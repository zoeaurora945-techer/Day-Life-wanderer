import { Component, type ReactNode } from 'react'
import { useTaskStore } from '../../store/useTaskStore'
import { t } from '../../i18n/translations'

interface Props {
  children: ReactNode
  label?: string
}

interface State {
  hasError: boolean
}

/**
 * @description Isolates a view so a render error in new modules (galaxy/anchor)
 * cannot blank the whole app. Keeps the rest of the tabs usable.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: unknown) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', this.props.label, error)
  }

  render() {
    const { lang } = useTaskStore((s) => s)
    if (this.state.hasError) {
      return (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-base text-red-700">
          <p>{this.props.label ?? '这个模块'}</p>
          <p>{t(lang, 'error.galaxy')}</p>
          <p className="mt-1 text-sm text-red-500">{t(lang, 'error.otherwise_fine')}</p>
        </div>
      )
    }
    return this.props.children
  }
}
