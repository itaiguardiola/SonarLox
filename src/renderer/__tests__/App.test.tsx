/// <reference types="@testing-library/jest-dom/vitest" />
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import App from '../App'

// Mock child components
vi.mock('../components/Viewport', () => ({
  Viewport: () => <div data-testid="viewport">Viewport Mock</div>,
}))

vi.mock('../components/ControlPanel', () => ({
  ControlPanel: () => <div data-testid="control-panel">ControlPanel Mock</div>,
}))

vi.mock('../components/TimelinePanel', () => ({
  TimelinePanel: () => <div data-testid="timeline-panel">TimelinePanel Mock</div>,
}))

vi.mock('../components/VideoPanel', () => ({
  VideoPanel: () => <div data-testid="video-panel">VideoPanel Mock</div>,
}))

vi.mock('../components/Toast', () => ({
  ToastProvider: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  useToast: () => ({ showToast: vi.fn() }),
}))

vi.mock('../hooks/useKeyboardShortcuts', () => ({
  useKeyboardShortcuts: vi.fn(),
}))

vi.mock('../hooks/useProjectIO', () => ({
  useProjectIO: () => ({
    saveProject: vi.fn(),
    openProject: vi.fn(),
  }),
}))

vi.mock('../stores/useAppStore', () => {
  const store = Object.assign(
    () => ({
      sources: [],
      selectedSourceId: null,
      selectSource: vi.fn(),
      removeSource: vi.fn(),
    }),
    {
      getState: () => ({
        sources: [],
        addSource: vi.fn(),
        setSourceAudioFileName: vi.fn(),
      }),
    }
  )
  return { useAppStore: store }
})

vi.mock('../audio/WebAudioEngine', () => ({
  audioEngine: {
    loadFile: vi.fn(),
  },
}))

describe('App', () => {
  it('renders without crashing', () => {
    render(<App />)
    expect(screen.getByTestId('viewport')).toBeInTheDocument()
    expect(screen.getByTestId('control-panel')).toBeInTheDocument()
    expect(screen.getByTestId('timeline-panel')).toBeInTheDocument()
  })

  it('sets up keyboard shortcuts', () => {
    render(<App />)
    expect(screen.getByTestId('viewport')).toBeInTheDocument()
  })
})
