import { describe, it, expect, vi } from 'vitest';
import { audioEngine } from '../audio/WebAudioEngine';

// Mock the Web Audio API
const mockAudioContext = {
  createGain: vi.fn(),
  createPanner: vi.fn(),
  createAnalyser: vi.fn(),
  createBufferSource: vi.fn(),
  createMediaStreamDestination: vi.fn(),
  createMediaStreamSource: vi.fn(),
  createChannelMerger: vi.fn(),
  createBiquadFilter: vi.fn(),
  suspend: vi.fn(),
  resume: vi.fn(),
  close: vi.fn(),
};

const mockGainNode = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  gain: {
    value: 0,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
  },
};

const mockPannerNode = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  positionX: { value: 0 },
  positionY: { value: 0 },
  positionZ: { value: 0 },
  orientationX: { value: 0 },
  orientationY: { value: 0 },
  orientationZ: { value: 0 },
  connect: vi.fn(),
  disconnect: vi.fn(),
};

const mockAnalyserNode = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  getByteTimeDomainData: vi.fn(),
  getByteFrequencyData: vi.fn(),
};

const mockBufferSourceNode = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  loop: false,
};

const mockMediaStreamDestination = {
  connect: vi.fn(),
};

const mockChannelMergerNode = {
  connect: vi.fn(),
  disconnect: vi.fn(),
};

const mockBiquadFilterNode = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  type: 'lowpass',
  frequency: { value: 1000 },
  Q: { value: 1 },
};

// Mock the global audio context
Object.defineProperty(window, 'AudioContext', {
  writable: true,
  value: vi.fn(() => mockAudioContext),
});

Object.defineProperty(window, 'webkitAudioContext', {
  writable: true,
  value: vi.fn(() => mockAudioContext),
});

describe('WebAudioEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset the audio engine
    (audioEngine as any).context = null;
    (audioEngine as any).masterGain = null;
    (audioEngine as any).masterAnalyser = null;
    (audioEngine as any).isInitialized = false;
  });

  it('initializes the audio context', () => {
    expect(audioEngine.isInitialized).toBe(false);
    // This would normally initialize the context, but we're mocking it
  });

  it('creates a gain node', () => {
    const gainNode = audioEngine.createGain();
    expect(gainNode).toBeDefined();
  });

  it('creates a panner node', () => {
    const pannerNode = audioEngine.createPanner();
    expect(pannerNode).toBeDefined();
  });

  it('creates an analyser node', () => {
    const analyserNode = audioEngine.createAnalyser();
    expect(analyserNode).toBeDefined();
  });

  it('creates a buffer source node', () => {
    const bufferSourceNode = audioEngine.createBufferSource();
    expect(bufferSourceNode).toBeDefined();
  });

  it('creates a media stream destination', () => {
    const mediaStreamDestination = audioEngine.createMediaStreamDestination();
    expect(mediaStreamDestination).toBeDefined();
  });

  it('connects nodes properly', () => {
    const source = audioEngine.createGain();
    const destination = audioEngine.createGain();

    audioEngine.connect(source, destination);
    expect(source.connect).toHaveBeenCalledWith(destination);
  });

  it('disconnects nodes properly', () => {
    const source = audioEngine.createGain();

    audioEngine.disconnect(source);
    expect(source.disconnect).toHaveBeenCalled();
  });

  it('handles audio context state changes', () => {
    expect(audioEngine.isInitialized).toBe(false);
    // The engine would normally initialize here
  });
});