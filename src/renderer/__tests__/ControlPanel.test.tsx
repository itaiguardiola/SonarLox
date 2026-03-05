/// <reference types="@testing-library/jest-dom/vitest" />
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ControlPanel } from '../components/ControlPanel'

// Mock all section components used by ControlPanel
vi.mock('../components/sections/SessionSection', () => ({
  SessionSection: () => <div data-testid="session-section">SessionSection</div>,
}))

vi.mock('../components/sections/OutputSection', () => ({
  OutputSection: () => <div data-testid="output-section">OutputSection</div>,
}))

vi.mock('../components/SourceList', () => ({
  SourceList: () => <div data-testid="source-list">SourceList</div>,
}))

vi.mock('../components/sections/SourcePropertiesSection', () => ({
  SourcePropertiesSection: () => <div data-testid="source-properties">SourceProperties</div>,
}))

vi.mock('../components/sections/TransportSection', () => ({
  TransportSection: () => <div data-testid="transport-section">TransportSection</div>,
}))

vi.mock('../components/sections/EnvironmentSection', () => ({
  EnvironmentSection: () => <div data-testid="environment-section">EnvironmentSection</div>,
}))

vi.mock('../components/PluginPanel', () => ({
  PluginPanel: () => <div data-testid="plugin-panel">PluginPanel</div>,
}))

vi.mock('../components/sections/VideoSection', () => ({
  VideoSection: () => <div data-testid="video-section">VideoSection</div>,
}))

vi.mock('../components/sections/CameraSection', () => ({
  CameraSection: () => <div data-testid="camera-section">CameraSection</div>,
}))

vi.mock('../stores/useAppStore', () => ({
  useAppStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ selectedSourceId: null }),
}))

describe('ControlPanel', () => {
  it('renders without crashing', () => {
    render(<ControlPanel />)
    expect(screen.getByText('SPATIAL AUDIO EDITOR')).toBeInTheDocument()
  })

  it('renders all section components', () => {
    render(<ControlPanel />)
    expect(screen.getByTestId('session-section')).toBeInTheDocument()
    expect(screen.getByTestId('output-section')).toBeInTheDocument()
    expect(screen.getByTestId('source-list')).toBeInTheDocument()
    expect(screen.getByTestId('transport-section')).toBeInTheDocument()
    expect(screen.getByTestId('environment-section')).toBeInTheDocument()
    expect(screen.getByTestId('plugin-panel')).toBeInTheDocument()
    expect(screen.getByTestId('camera-section')).toBeInTheDocument()
  })
})
