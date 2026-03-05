import { StateCreator } from 'zustand'
import { AppState, DemucsProbeResult } from '../../types'

export interface DemucsSlice {
  demucsProbe: DemucsProbeResult | null
  demucsStatus: 'idle' | 'probing' | 'separating' | 'installing' | 'error'
  demucsProgress: number
  demucsError: string | null

  setDemucsProbe: (probe: DemucsProbeResult | null) => void
  setDemucsStatus: (status: DemucsSlice['demucsStatus']) => void
  setDemucsProgress: (p: number) => void
  setDemucsError: (e: string | null) => void
}

export const createDemucsSlice: StateCreator<AppState, [], [], DemucsSlice> = (set) => ({
  demucsProbe: null,
  demucsStatus: 'idle',
  demucsProgress: 0,
  demucsError: null,

  setDemucsProbe: (demucsProbe) => set({ demucsProbe }),
  setDemucsStatus: (demucsStatus) => set({ demucsStatus }),
  setDemucsProgress: (demucsProgress) => set({ demucsProgress }),
  setDemucsError: (demucsError) => set({ demucsError }),
})
