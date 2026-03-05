import { useShallow } from 'zustand/react/shallow'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Room } from './Room'
import { Listener } from './Listener'
import { SoundSource } from './SoundSource'
import { AudioBridge } from './AudioBridge'
import { DistanceRings } from './DistanceRings'
import { MotionPath } from './MotionPath'
import { AudioVisualizer } from './AudioVisualizer'
import { PluginVisualizers } from './PluginVisualizers'
import { CameraManager } from './CameraManager'
import { VideoScreenBridge } from './VideoScreenBridge'
import { useAppStore } from '../stores/useAppStore'

/**
 * Main 3D viewport component for the SonarLox spatial audio editor.
 * Renders the 3D scene with room, listener, sound sources, and visualizations.
 * Uses React Three Fiber for rendering and OrbitControls for camera navigation.
 */
export function Viewport() {
  const sourceIds = useAppStore(useShallow((s) => s.sources.map((src) => src.id)))
  const roomSize = useAppStore((s) => s.roomSize)

  return (
    <Canvas
      camera={{ position: [8, 6, 8], fov: 50 }}
      style={{ width: '100%', height: '100%' }}
    >
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 8, 5]} intensity={0.8} />
      <OrbitControls makeDefault />
      <CameraManager />
      <gridHelper args={[Math.max(roomSize[0], roomSize[1]), Math.max(roomSize[0], roomSize[1]), '#444466', '#333355']} />
      <Room />
      <Listener />
      {sourceIds.map((id) => (
        <SoundSource key={id} sourceId={id} />
      ))}
      <AudioBridge />
      <DistanceRings />
      <MotionPath />
      {sourceIds.map((id) => (
        <AudioVisualizer key={id} sourceId={id} />
      ))}
      <PluginVisualizers />
      <VideoScreenBridge />
    </Canvas>
  )
}
