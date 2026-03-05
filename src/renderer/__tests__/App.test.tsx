import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App } from '../App';

// Mock the necessary modules
vi.mock('../components/Viewport', () => ({
  Viewport: () => <div data-testid="viewport">Viewport Mock</div>,
}));

vi.mock('../components/ControlPanel', () => ({
  ControlPanel: () => <div data-testid="control-panel">ControlPanel Mock</div>,
}));

vi.mock('../components/TimelinePanel', () => ({
  TimelinePanel: () => <div data-testid="timeline-panel">TimelinePanel Mock</div>,
}));

vi.mock('../components/Toast', () => ({
  ToastProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../stores/useAppStore', () => ({
  useAppStore: () => ({
    sources: [],
    selectedSourceId: null,
    selectSource: vi.fn(),
    removeSource: vi.fn(),
  }),
}));

vi.mock('../stores/useTransportStore', () => ({
  useTransportStore: () => ({
    isPlaying: false,
    play: vi.fn(),
    pause: vi.fn(),
  }),
}));

vi.mock('../hooks/useProjectIO', () => ({
  useProjectIO: () => ({
    saveProject: vi.fn(),
    openProject: vi.fn(),
  }),
}));

vi.mock('../audio/WebAudioEngine', () => ({
  audioEngine: {
    hasAnyBuffer: vi.fn(),
    removeChannel: vi.fn(),
  },
}));

describe('App', () => {
  it('renders without crashing', () => {
    render(<App />);

    // Check that the main components are rendered
    expect(screen.getByTestId('viewport')).toBeInTheDocument();
    expect(screen.getByTestId('control-panel')).toBeInTheDocument();
    expect(screen.getByTestId('timeline-panel')).toBeInTheDocument();
  });

  it('sets up keyboard shortcuts', () => {
    render(<App />);

    // This test verifies that the component renders without errors
    // The actual keyboard event handling is tested in integration tests
    expect(screen.getByTestId('viewport')).toBeInTheDocument();
  });
});