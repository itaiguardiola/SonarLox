import { useEffect, useRef, RefObject } from 'react'
import { useTransportStore } from '../stores/useTransportStore'
import { useAppStore } from '../stores/useAppStore'

export function useVideoSync(videoRef: RefObject<HTMLVideoElement | null>) {
  const driftIntervalRef = useRef<number | null>(null)

  useEffect(() => {
    const unsubscribe = useTransportStore.subscribe((state, prev) => {
      const video = videoRef.current
      if (!video || !video.src) return

      const offset = useAppStore.getState().videoOffset

      // Play
      if (state.isPlaying && !prev.isPlaying) {
        const targetTime = Math.max(0, state.playheadPosition - offset)
        video.currentTime = targetTime
        video.play().catch(() => {})

        // Start drift correction
        if (driftIntervalRef.current) clearInterval(driftIntervalRef.current)
        driftIntervalRef.current = window.setInterval(() => {
          const v = videoRef.current
          if (!v || v.paused) return
          const currentOffset = useAppStore.getState().videoOffset
          const transport = useTransportStore.getState()
          const expected = Math.max(0, transport.playheadPosition - currentOffset)
          const drift = Math.abs(v.currentTime - expected)
          if (drift > 0.05) {
            v.currentTime = expected
          }
        }, 33)
      }

      // Pause
      if (!state.isPlaying && prev.isPlaying && state.isPaused) {
        video.pause()
        if (driftIntervalRef.current) {
          clearInterval(driftIntervalRef.current)
          driftIntervalRef.current = null
        }
      }

      // Stop
      if (!state.isPlaying && !state.isPaused && (prev.isPlaying || prev.isPaused)) {
        video.pause()
        video.currentTime = Math.max(0, -offset)
        if (driftIntervalRef.current) {
          clearInterval(driftIntervalRef.current)
          driftIntervalRef.current = null
        }
      }

      // Seek (playhead changed while paused or stopped)
      if (!state.isPlaying && state.playheadPosition !== prev.playheadPosition) {
        const targetTime = Math.max(0, state.playheadPosition - offset)
        video.currentTime = targetTime
      }
    })

    return () => {
      unsubscribe()
      if (driftIntervalRef.current) {
        clearInterval(driftIntervalRef.current)
        driftIntervalRef.current = null
      }
    }
  }, [videoRef])
}
