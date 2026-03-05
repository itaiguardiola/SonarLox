// Setup file for tests
import '@testing-library/jest-dom/vitest';
import type { ElectronAPI } from '../renderer/types';

// Mock window.api if it doesn't exist
if (typeof window !== 'undefined' && !window.api) {
  window.api = {
    showConfirmDialog: vi.fn(),
    showOpenDialog: vi.fn(),
    showSaveDialog: vi.fn(),
  } as unknown as ElectronAPI;
}

// Mock requestAnimationFrame
global.requestAnimationFrame = vi.fn((callback) => setTimeout(callback, 0));

// Mock IntersectionObserver
class MockIntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

global.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;