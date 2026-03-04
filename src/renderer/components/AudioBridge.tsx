import { useFrame } from '@react-three/fiber'
import { audioEngine } from '../audio/AudioEngine'
import { useAppStore } from '../stores/useAppStore'

export function AudioBridge() {
  useFrame(() => {
    const state = useAppStore.getState()
    audioEngine.setListenerY(state.listenerY)

    for (const source of state.sources) {
      const [x, y, z] = source.position
      audioEngine.setPosition(source.id, x, y, z)
      // Set volume to 0 when muted, otherwise real volume
      audioEngine.setVolume(source.id, source.isMuted ? 0 : source.volume)
    }
  })

  return null
}
