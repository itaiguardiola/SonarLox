import { StateCreator } from 'zustand'
import { AppState, SourcePosition } from '../../types'

export interface VideoSlice {
  videoFilePath: string | null
  videoFileName: string | null
  videoOffset: number
  videoFrameRate: number
  isVideoVisible: boolean
  videoOpacity: number
  videoScreenPosition: SourcePosition
  videoScreenScale: number
  videoScreenLocked: boolean
  videoScreenVisible: boolean

  setVideoFile: (path: string, name: string) => void
  clearVideo: () => void
  setVideoOffset: (offset: number) => void
  setVideoFrameRate: (rate: number) => void
  setIsVideoVisible: (visible: boolean) => void
  setVideoOpacity: (opacity: number) => void
  setVideoScreenPosition: (pos: SourcePosition) => void
  setVideoScreenScale: (scale: number) => void
  setVideoScreenLocked: (locked: boolean) => void
  setVideoScreenVisible: (visible: boolean) => void
}

export const createVideoSlice: StateCreator<AppState, [], [], VideoSlice> = (set) => ({
  videoFilePath: null,
  videoFileName: null,
  videoOffset: 0,
  videoFrameRate: 24,
  isVideoVisible: true,
  videoOpacity: 1.0,
  videoScreenPosition: [0, 3, -4] as SourcePosition,
  videoScreenScale: 3,
  videoScreenLocked: false,
  videoScreenVisible: true,

  setVideoFile: (path, name) => set({ videoFilePath: path, videoFileName: name }),
  clearVideo: () => set({
    videoFilePath: null,
    videoFileName: null,
    videoOffset: 0,
    videoScreenVisible: true,
    videoScreenLocked: false,
  }),
  setVideoOffset: (offset) => set({ videoOffset: Math.max(-300, Math.min(300, offset)) }),
  setVideoFrameRate: (rate) => set({ videoFrameRate: rate }),
  setIsVideoVisible: (visible) => set({ isVideoVisible: visible }),
  setVideoOpacity: (opacity) => set({ videoOpacity: Math.max(0, Math.min(1, opacity)) }),
  setVideoScreenPosition: (pos) => set({ videoScreenPosition: pos }),
  setVideoScreenScale: (scale) => set({ videoScreenScale: Math.max(1, Math.min(10, scale)) }),
  setVideoScreenLocked: (locked) => set({ videoScreenLocked: locked }),
  setVideoScreenVisible: (visible) => set({ videoScreenVisible: visible }),
})
