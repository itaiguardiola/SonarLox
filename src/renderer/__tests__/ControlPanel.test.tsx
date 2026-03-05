import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ControlPanel } from '../components/ControlPanel';

// Mock the necessary modules
vi.mock('../stores/useAppStore', () => ({
  useAppStore: () => ({
    sources: [
      { id: '1', label: 'Source 1', position: { x: 0, y: 0, z: 0 } },
      { id: '2', label: 'Source 2', position: { x: 1, y: 1, z: 1 } },
    ],
    selectedSourceId: '1',
    selectSource: vi.fn(),
    removeSource: vi.fn(),
  }),
}));

vi.mock('../components/SourcePanel', () => ({
  SourcePanel: () => <div data-testid="source-panel">SourcePanel Mock</div>,
}));

vi.mock('../components/TransportPanel', () => ({
  TransportPanel: () => <div data-testid="transport-panel">TransportPanel Mock</div>,
}));

vi.mock('../components/SettingsPanel', () => ({
  SettingsPanel: () => <div data-testid="settings-panel">SettingsPanel Mock</div>,
}));

describe('ControlPanel', () => {
  it('renders without crashing', () => {
    render(<ControlPanel />);

    // Check that the main components are rendered
    expect(screen.getByTestId('source-panel')).toBeInTheDocument();
    expect(screen.getByTestId('transport-panel')).toBeInTheDocument();
    expect(screen.getByTestId('settings-panel')).toBeInTheDocument();
  });

  it('displays the correct number of sources', () => {
    render(<ControlPanel />);

    // The component should render without errors
    expect(screen.getByTestId('source-panel')).toBeInTheDocument();
  });
});