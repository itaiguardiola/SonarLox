import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SoundSource } from '../components/SoundSource';

// Mock the necessary modules
vi.mock('@react-three/fiber', () => ({
  useFrame: vi.fn(),
  useThree: vi.fn(() => ({
    camera: {
      position: { x: 0, y: 0, z: 0 },
    },
  })),
}));

vi.mock('../stores/useAppStore', () => ({
  useAppStore: () => ({
    sources: [
      { id: '1', label: 'Source 1', position: { x: 0, y: 0, z: 0 } },
    ],
    selectedSourceId: '1',
    selectSource: vi.fn(),
    removeSource: vi.fn(),
  }),
}));

describe('SoundSource', () => {
  it('renders without crashing', () => {
    render(<SoundSource id="1" label="Test Source" position={{ x: 0, y: 0, z: 0 }} />);

    // Check that the component renders without errors
    expect(screen.getByText('Test Source')).toBeInTheDocument();
  });

  it('handles position updates', () => {
    render(<SoundSource id="1" label="Test Source" position={{ x: 1, y: 1, z: 1 }} />);

    // The component should render without errors
    expect(screen.getByText('Test Source')).toBeInTheDocument();
  });

  it('sets up proper source properties', () => {
    const props = {
      id: '1',
      label: 'Test Source',
      position: { x: 0, y: 0, z: 0 },
    };

    render(<SoundSource {...props} />);

    // The component should render without errors
    expect(screen.getByText('Test Source')).toBeInTheDocument();
  });
});