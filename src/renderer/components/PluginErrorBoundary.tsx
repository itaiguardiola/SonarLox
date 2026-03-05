import React, { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
  pluginName: string
  onReset?: () => void
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * Error boundary component for isolating plugin rendering errors.
 * Prevents a single faulty plugin from crashing the entire R3F viewport or app.
 */
export class PluginErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`Plugin "${this.props.pluginName}" crashed during render:`, error, errorInfo)
  }

  public render() {
    if (this.state.hasError) {
      return (
        <group>
          {/* We render nothing in the scene but log the error */}
          {/* In a real app, we might render a small warning icon in the 3D space */}
        </group>
      )
    }

    return this.props.children
  }
}
