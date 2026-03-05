import { StateCreator } from 'zustand'
import { AppState, AudioSource, SourceId, SourcePosition, SourceType, SOURCE_COLORS, MAX_SOURCES } from '../../types'

export interface SourceSlice {
  sources: AudioSource[]
  selectedSourceId: SourceId | null
  addSource: (type: SourceType) => void
  addSourceRaw: (source: AudioSource) => void
  removeSource: (id: SourceId) => void
  selectSource: (id: SourceId | null) => void
  setSourcePosition: (id: SourceId, position: SourcePosition) => void
  setSourceVolume: (id: SourceId, volume: number) => void
  setSourceAudioFileName: (id: SourceId, name: string | null) => void
  setSourceAudioFilePath: (id: SourceId, path: string | null) => void
  setSourceSineFrequency: (id: SourceId, freq: number) => void
  setSourceMuted: (id: SourceId, muted: boolean) => void
  setSourceSoloed: (id: SourceId, soloed: boolean) => void
  setSourceLabel: (id: SourceId, label: string) => void
}

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
    audioFilePath: null,
    sineFrequency: 440,
    isMuted: false,
    isSoloed: false,
  }
}

export const createSourceSlice: StateCreator<AppState, [], [], SourceSlice> = (set, get) => ({
  sources: [],
  selectedSourceId: null,

  addSource: (type: SourceType) => {
    get().recordHistory(`Add ${type} source`)
    const { sources } = get()
    if (sources.length >= MAX_SOURCES) return
    nextSourceIndex++
    const newSource = createDefaultSource(nextSourceIndex, type)
    set({ sources: [...sources, newSource], selectedSourceId: newSource.id, isDirty: true })
  },

  addSourceRaw: (source: AudioSource) => {
    const { sources } = get()
    if (sources.length >= MAX_SOURCES) return
    set({ sources: [...sources, source], isDirty: true })
  },

  removeSource: (id: SourceId) => {
    get().recordHistory('Remove source')
    const { sources, selectedSourceId, animations } = get()
    if (sources.length === 0) return
    const filtered = sources.filter((s) => s.id !== id)
    const newSelected =
      selectedSourceId === id ? filtered[0]?.id ?? null : selectedSourceId
    const nextAnimations = { ...animations }
    delete nextAnimations[id]
    set({ sources: filtered, selectedSourceId: newSelected, animations: nextAnimations, isDirty: true })
  },

  selectSource: (id: SourceId | null) => set({ selectedSourceId: id }),

  setSourcePosition: (id, position) =>
    set((state) => ({
      sources: state.sources.map((s) => (s.id === id ? { ...s, position } : s)),
      isDirty: true,
    })),

  setSourceVolume: (id, volume) =>
    set((state) => ({
      sources: state.sources.map((s) => (s.id === id ? { ...s, volume } : s)),
      isDirty: true,
    })),

  setSourceAudioFileName: (id, audioFileName) =>
    set((state) => ({
      sources: state.sources.map((s) =>
        s.id === id ? { ...s, audioFileName } : s
      ),
      isDirty: true,
    })),

  setSourceAudioFilePath: (id, audioFilePath) =>
    set((state) => ({
      sources: state.sources.map((s) =>
        s.id === id ? { ...s, audioFilePath } : s
      ),
    })),

  setSourceSineFrequency: (id, sineFrequency) =>
    set((state) => ({
      sources: state.sources.map((s) =>
        s.id === id ? { ...s, sineFrequency } : s
      ),
      isDirty: true,
    })),

  setSourceMuted: (id, isMuted) =>
    set((state) => ({
      sources: state.sources.map((s) =>
        s.id === id ? { ...s, isMuted } : s
      ),
      isDirty: true,
    })),

  setSourceSoloed: (id, isSoloed) =>
    set((state) => ({
      sources: state.sources.map((s) =>
        s.id === id ? { ...s, isSoloed } : s
      ),
      isDirty: true,
    })),

  setSourceLabel: (id, label) => {
    get().recordHistory('Change label')
    set((state) => ({
      sources: state.sources.map((s) =>
        s.id === id ? { ...s, label } : s
      ),
      isDirty: true,
    }))
  },
})
