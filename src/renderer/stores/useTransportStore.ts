import { create } from 'zustand'
import { audioEngine } from '../audio/WebAudioEngine'
import { useAppStore } from './useAppStore'

interface TransportStoreState {
  isPlaying: boolean
  isPaused: boolean
  playheadPosition: number
  duration: number
  isLooping: boolean

  play: () => void
  pause: () => void
  stop: () => void
  seek: (position: number) => void
  toggleLoop: () => void
  updatePlayhead: () => void
}

let animFrameId: number | null = null

function startPlayheadLoop(update: () => void) {
  const tick = () => {
    update()
    animFrameId = requestAnimationFrame(tick)
  }
  animFrameId = requestAnimationFrame(tick)
}

function stopPlayheadLoop() {
  if (animFrameId !== null) {
    cancelAnimationFrame(animFrameId)
    animFrameId = null
  }
}

export const useTransportStore = create<TransportStoreState>((set, get) => ({
  isPlaying: false,
  isPaused: false,
  playheadPosition: 0,
  duration: 0,
  isLooping: true,

  play: () => {
    audioEngine.playAll()
    const duration = audioEngine.getDuration()
    set({ isPlaying: true, isPaused: false, duration })
    useAppStore.getState().setIsPlaying(true)
    startPlayheadLoop(get().updatePlayhead)
  },

  pause: () => {
    audioEngine.pauseAll()
    set({ isPlaying: false, isPaused: true })
    useAppStore.getState().setIsPlaying(false)
    stopPlayheadLoop()
  },

  stop: () => {
    audioEngine.stopAll()
    set({ isPlaying: false, isPaused: false, playheadPosition: 0 })
    useAppStore.getState().setIsPlaying(false)
    stopPlayheadLoop()
  },

  seek: (_position: number) => {
    // Seeking requires stopping and restarting with offset — simplified for now
    // Full seek support would require setting pauseOffset on all channels
    // For now, just update the visual playhead
    set({ playheadPosition: _position })
  },

  toggleLoop: () => {
    const next = !get().isLooping
    audioEngine.setLooping(next)
    set({ isLooping: next })
    useAppStore.getState().setIsLooping(next)
  },

  updatePlayhead: () => {
    const pos = audioEngine.getPlayheadPosition()
    const duration = audioEngine.getDuration()
    set({ playheadPosition: pos, duration })

    // Check if playback ended (non-looping, past duration)
    if (!get().isLooping && pos >= duration && duration > 0) {
      get().stop()
    }
  },
}))
