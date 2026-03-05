import { useFrame } from '@react-three/fiber'
import { audioEngine } from '../audio/WebAudioEngine'
import { useAppStore } from '../stores/useAppStore'
import { useTransportStore } from '../stores/useTransportStore'
import { getAnimatedPosition } from '../audio/AnimationEngine'

/**
 * AudioBridge is a React Three Fiber component that synchronizes the 3D spatial audio state
 * with the Web Audio API engine. It updates listener position, master volume, and individual
 * source positions and volumes each frame based on the current app state and transport controls.
 * It handles animation playback, solo/mute logic, and real-time spatialization updates for
 * all audio sources in the scene.
 */
export function AudioBridge() {
  useFrame(() => {
    const state = useAppStore.getState()
    const transport = useTransportStore.getState()
    audioEngine.setListenerY(state.listenerY)
    audioEngine.setMasterVolume(state.masterVolume)

    const anySoloed = state.sources.some((s) => s.isSoloed)
    const useAnimation = transport.isPlaying || transport.isPaused

    for (const source of state.sources) {
      let [x, y, z] = source.position
      if (useAnimation && state.animations[source.id]?.keyframes.length) {
        ;[x, y, z] = getAnimatedPosition(
          source.id,
          transport.playheadPosition,
          state.animations,
          source.position,
        )
      }
      audioEngine.setPosition(source.id, x, y, z)

      // Muted sources are always silent
      // If any source is soloed, non-soloed sources are silent
      // Soloed + muted = still silent
      let effectiveVolume: number
      if (source.isMuted) {
        effectiveVolume = 0
      } else if (anySoloed && !source.isSoloed) {
        effectiveVolume = 0
      } else {
        effectiveVolume = source.volume
      }
      audioEngine.setVolume(source.id, effectiveVolume)
    }
  })

  return null
}
