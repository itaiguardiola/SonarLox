import { create } from 'zustand'
import type { AppState, AudioSource, SourceId, SourceType } from '../types'
import { SOURCE_COLORS, MAX_SOURCES } from '../types'

let nextSourceIndex = 1

function createDefaultSource(index: number, type: SourceType): AudioSource {
  return {
    id: crypto.randomUUID(),
    label: `Source ${index}`,
    sourceType: type,
    position: [2 + (index - 1) * 1.5, 1, (index - 1) * 1.5],
    volume: 1.0,
    color: SOURCE_COLORS[(index - 1) % SOURCE_COLORS.length],
    audioFileName: null,
    sineFrequency: 440,
    isMuted: false,
    isSoloed: false,
  }
}

const initialSource = createDefaultSource(1, 'file')

export const useAppStore = create<AppState>((set, get) => ({
  sources: [initialSource],
  selectedSourceId: initialSource.id,

  addSource: (type: SourceType) => {
    const { sources } = get()
    if (sources.length >= MAX_SOURCES) return
    nextSourceIndex++
    const newSource = createDefaultSource(nextSourceIndex, type)
    set({ sources: [...sources, newSource], selectedSourceId: newSource.id })
  },

  removeSource: (id: SourceId) => {
    const { sources, selectedSourceId } = get()
    if (sources.length <= 1) return
    const filtered = sources.filter((s) => s.id !== id)
    const newSelected =
      selectedSourceId === id ? filtered[0]?.id ?? null : selectedSourceId
    set({ sources: filtered, selectedSourceId: newSelected })
  },

  selectSource: (id: SourceId | null) => set({ selectedSourceId: id }),

  setSourcePosition: (id, position) =>
    set((state) => ({
      sources: state.sources.map((s) => (s.id === id ? { ...s, position } : s)),
    })),

  setSourceVolume: (id, volume) =>
    set((state) => ({
      sources: state.sources.map((s) => (s.id === id ? { ...s, volume } : s)),
    })),

  setSourceAudioFileName: (id, audioFileName) =>
    set((state) => ({
      sources: state.sources.map((s) =>
        s.id === id ? { ...s, audioFileName } : s
      ),
    })),

  setSourceSineFrequency: (id, sineFrequency) =>
    set((state) => ({
      sources: state.sources.map((s) =>
        s.id === id ? { ...s, sineFrequency } : s
      ),
    })),

  setSourceMuted: (id, isMuted) =>
    set((state) => ({
      sources: state.sources.map((s) =>
        s.id === id ? { ...s, isMuted } : s
      ),
    })),

  setSourceSoloed: (id, isSoloed) =>
    set((state) => ({
      sources: state.sources.map((s) =>
        s.id === id ? { ...s, isSoloed } : s
      ),
    })),

  setSourceLabel: (id, label) =>
    set((state) => ({
      sources: state.sources.map((s) =>
        s.id === id ? { ...s, label } : s
      ),
    })),

  soundFontName: null,
  setSoundFontName: (soundFontName) => set({ soundFontName }),

  isPlaying: false,
  isLooping: true,
  listenerY: 0,
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setIsLooping: (isLooping) => set({ isLooping }),
  setListenerY: (listenerY) => set({ listenerY }),

  isExporting: false,
  setIsExporting: (isExporting) => set({ isExporting }),
  exportProgress: 0,
  setExportProgress: (exportProgress) => set({ exportProgress }),

  masterVolume: 1.0,
  setMasterVolume: (masterVolume) => set({ masterVolume }),
  selectedOutputDevice: null,
  setSelectedOutputDevice: (selectedOutputDevice) => set({ selectedOutputDevice }),

  cameraPresets: [null, null, null, null],
  setCameraPreset: (index, preset) =>
    set((state) => {
      const next = [...state.cameraPresets]
      next[index] = preset
      return { cameraPresets: next }
    }),
  cameraCommand: null,
  setCameraCommand: (cameraCommand) => set({ cameraCommand }),
}))
