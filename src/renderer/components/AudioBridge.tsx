import { useFrame } from '@react-three/fiber'
import { audioEngine } from '../audio/WebAudioEngine'
import { useAppStore } from '../stores/useAppStore'

export function AudioBridge() {
  useFrame(() => {
    const state = useAppStore.getState()
    audioEngine.setListenerY(state.listenerY)
    audioEngine.setMasterVolume(state.masterVolume)

    const anySoloed = state.sources.some((s) => s.isSoloed)

    for (const source of state.sources) {
      const [x, y, z] = source.position
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
