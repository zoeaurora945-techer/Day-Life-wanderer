import { Component, type ReactNode } from 'react'

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
    if (this.state.hasError) {
      return (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {this.props.label ?? '这个模块'}加载出错，但其他功能不受影响。刷新页面再试试～
        </div>
      )
    }
    return this.props.children
  }
}
