import { useAppStore } from '../stores/useAppStore'

export function Room() {
  /**
   * Renders a 3D room mesh that serves as the spatial audio environment boundary.
   * This wireframe room represents the confined space where audio sources are positioned
   * and spatialized using HRTF binaural rendering techniques.
   * The room dimensions are dynamic based on the store, with a default height of 10 units.
   */
  const roomSize = useAppStore((s) => s.roomSize)
  const [width, depth] = roomSize

  return (
    <mesh position={[0, 5, 0]}>
      <boxGeometry args={[width, 10, depth]} />
      <meshBasicMaterial wireframe transparent opacity={0.3} color="#4466aa" />
    </mesh>
  )
}
