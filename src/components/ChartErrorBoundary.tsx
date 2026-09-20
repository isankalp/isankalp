import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  label: string
}

interface State {
  hasError: boolean
}

/** Isolates a single chart's render failure so it doesn't take down the rest of the Insights screen (IN UI spec). */
export default class ChartErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-3 rounded-lg border border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-500/10 text-xs text-red-600 dark:text-red-400">
          Couldn't load {this.props.label}.
        </div>
      )
    }
    return this.props.children
  }
}
