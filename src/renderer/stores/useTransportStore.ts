import { create } from 'zustand'
import { audioEngine } from '../audio/WebAudioEngine'
import { useAppStore } from './useAppStore'

/**
 * State interface for the transport controls in the spatial audio editor.
 * Manages playback state, playhead position, and looping behavior.
 */
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

/**
 * Animation frame ID used to manage the playhead update loop.
 */
let animFrameId: number | null = null

/**
 * Starts a continuous loop to update the playhead position using requestAnimationFrame.
 * This is used during playback to keep the playhead moving in sync with audio.
 */
function startPlayheadLoop(update: () => void) {
  const tick = () => {
    update()
    animFrameId = requestAnimationFrame(tick)
  }
  animFrameId = requestAnimationFrame(tick)
}

/**
 * Stops the playhead update loop by canceling the animation frame.
 * Called when playback is paused or stopped.
 */
function stopPlayheadLoop() {
  if (animFrameId !== null) {
    cancelAnimationFrame(animFrameId)
    animFrameId = null
  }
}

/**
 * Zustand store for managing transport controls (play, pause, stop, seek, loop).
 * Integrates with the Web Audio Engine to control playback and updates the UI playhead.
 */
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
    // Seeking requires stopping and restarting with offset – simplified for now
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
