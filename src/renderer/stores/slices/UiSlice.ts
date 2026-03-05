import { StateCreator } from 'zustand'
import { AppState, CameraPreset, CameraCommand } from '../../types'

export interface UiSlice {
  isPlaying: boolean
  isLooping: boolean
  isExporting: boolean
  exportProgress: number
  cameraPresets: (CameraPreset | null)[]
  cameraCommand: CameraCommand

  setIsPlaying: (isPlaying: boolean) => void
  setIsLooping: (isLooping: boolean) => void
  setIsExporting: (v: boolean) => void
  setExportProgress: (p: number) => void
  setCameraPreset: (index: number, preset: CameraPreset | null) => void
  setCameraCommand: (cmd: CameraCommand) => void
}

export const createUiSlice: StateCreator<AppState, [], [], UiSlice> = (set) => ({
  isPlaying: false,
  isLooping: true,
  isExporting: false,
  exportProgress: 0,
  cameraPresets: [null, null, null, null],
  cameraCommand: null,

  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setIsLooping: (isLooping) => set({ isLooping }),
  setIsExporting: (isExporting) => set({ isExporting }),
  setExportProgress: (exportProgress) => set({ exportProgress }),
  setCameraPreset: (index, preset) =>
    set((state) => {
      const next = [...state.cameraPresets]
      next[index] = preset
      return { cameraPresets: next }
    }),
  setCameraCommand: (cameraCommand) => set({ cameraCommand }),
})
