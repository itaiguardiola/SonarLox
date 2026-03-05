import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock SourceChannel before importing WebAudioEngine
vi.mock('../audio/SourceChannel', () => {
  return {
    SourceChannel: vi.fn().mockImplementation(() => ({
      dispose: vi.fn(),
      stop: vi.fn(),
      play: vi.fn(),
      pause: vi.fn(),
      isPaused: vi.fn(() => false),
      playTestTone: vi.fn(),
      setPosition: vi.fn(),
      setVolume: vi.fn(),
      setLooping: vi.fn(),
      setSineFrequency: vi.fn(),
      setPlayheadPosition: vi.fn(),
      audioBuffer: null,
      gainNode: { gain: { value: 1 } },
      pannerNode: {
        positionX: { value: 0 },
        positionY: { value: 0 },
        positionZ: { value: 0 },
      },
      analyserNode: {
        fftSize: 2048,
        frequencyBinCount: 1024,
        getFloatFrequencyData: vi.fn(),
        getFloatTimeDomainData: vi.fn(),
      },
    })),
  }
})

// Mock AudioContext
const mockGainNode = {
  gain: { value: 1 },
  connect: vi.fn(),
  disconnect: vi.fn(),
}
const mockAnalyserNode = {
  fftSize: 2048,
  connect: vi.fn(),
  disconnect: vi.fn(),
}
const mockAudioContext = {
  createGain: vi.fn(() => mockGainNode),
  createAnalyser: vi.fn(() => mockAnalyserNode),
  destination: {},
  state: 'running',
  resume: vi.fn(),
  close: vi.fn(),
  currentTime: 0,
  listener: { positionY: { value: 0 } },
  decodeAudioData: vi.fn(),
}

vi.stubGlobal('AudioContext', vi.fn(() => mockAudioContext))

// Import after mocks are in place
const { audioEngine } = await import('../audio/WebAudioEngine')

describe('WebAudioEngine', () => {
  beforeEach(async () => {
    // Reset engine internals
    audioEngine.dispose()
    vi.clearAllMocks()
    mockAudioContext.state = 'running'
  })

  it('initializes the audio context on init()', async () => {
    await audioEngine.init()
    expect(AudioContext).toHaveBeenCalled()
  })

  it('creates and removes channels', async () => {
    await audioEngine.init()
    audioEngine.createChannel('src-1')
    expect(audioEngine.getChannelIds()).toContain('src-1')

    audioEngine.removeChannel('src-1')
    expect(audioEngine.getChannelIds()).not.toContain('src-1')
  })

  it('sets master volume', async () => {
    await audioEngine.init()
    audioEngine.setMasterVolume(0.5)
    expect(mockGainNode.gain.value).toBe(0.5)
  })

  it('sets listener Y position', async () => {
    await audioEngine.init()
    audioEngine.setListenerY(2)
    expect(mockAudioContext.listener.positionY.value).toBe(2)
  })

  it('tracks looping state', () => {
    expect(audioEngine.getIsLooping()).toBe(true)
    audioEngine.setLooping(false)
    expect(audioEngine.getIsLooping()).toBe(false)
  })

  it('getDuration returns 0 with no buffers', () => {
    expect(audioEngine.getDuration()).toBe(0)
  })

  it('getAnalyser returns null for unknown source', () => {
    expect(audioEngine.getAnalyser('nonexistent')).toBeNull()
  })

  it('getAudioBuffer returns null for unknown source', () => {
    expect(audioEngine.getAudioBuffer('nonexistent')).toBeNull()
  })

  it('dispose cleans up all resources', async () => {
    await audioEngine.init()
    audioEngine.createChannel('src-1')
    audioEngine.dispose()
    expect(audioEngine.getChannelIds()).toHaveLength(0)
  })
})
