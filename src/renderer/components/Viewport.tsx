import { useShallow } from 'zustand/react/shallow'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Room } from './Room'
import { Listener } from './Listener'
import { SoundSource } from './SoundSource'
import { AudioBridge } from './AudioBridge'
import { DistanceRings } from './DistanceRings'
import { AudioVisualizer } from './AudioVisualizer'
import { CameraManager } from './CameraManager'
import { useAppStore } from '../stores/useAppStore'

export function Viewport() {
  const sourceIds = useAppStore(useShallow((s) => s.sources.map((src) => src.id)))

  return (
    <Canvas
      camera={{ position: [8, 6, 8], fov: 50 }}
      style={{ width: '100%', height: '100%' }}
    >
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 8, 5]} intensity={0.8} />
      <OrbitControls makeDefault />
      <CameraManager />
      <gridHelper args={[20, 20, '#444466', '#333355']} />
      <Room />
      <Listener />
      {sourceIds.map((id) => (
        <SoundSource key={id} sourceId={id} />
      ))}
      <AudioBridge />
      <DistanceRings />
      {sourceIds.map((id) => (
        <AudioVisualizer key={id} sourceId={id} />
      ))}
    </Canvas>
  )
}
