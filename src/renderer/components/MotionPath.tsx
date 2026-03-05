import { useMemo } from 'react'
import { Line } from '@react-three/drei'
import { useAppStore } from '../stores/useAppStore'
import { getAnimatedPosition } from '../audio/AnimationEngine'
import type { SourcePosition } from '../types'

const PATH_SAMPLES = 50
const GROUND_Y = 0.01

export function MotionPath() {
  const selectedSourceId = useAppStore((s) => s.selectedSourceId)
  const animations = useAppStore((s) => s.animations)
  const sources = useAppStore((s) => s.sources)

  const selectedSource = sources.find((s) => s.id === selectedSourceId)
  const anim = selectedSourceId ? animations[selectedSourceId] : undefined

  const { pathPoints, kfPoints, color } = useMemo(() => {
    if (!selectedSourceId || !anim || anim.keyframes.length < 2 || !selectedSource) {
      return { pathPoints: null, kfPoints: null, color: '#ffffff' }
    }

    const kfs = anim.keyframes
    const startTime = kfs[0].time
    const endTime = kfs[kfs.length - 1].time
    const span = endTime - startTime

    // Sample path points projected to ground plane
    const points: [number, number, number][] = []
    for (let i = 0; i <= PATH_SAMPLES; i++) {
      const t = startTime + (i / PATH_SAMPLES) * span
      const pos = getAnimatedPosition(selectedSourceId, t, animations, selectedSource.position)
      points.push([pos[0], GROUND_Y, pos[2]])
    }

    // Keyframe dot positions on ground
    const dots: SourcePosition[] = kfs.map((kf) => [kf.position[0], GROUND_Y, kf.position[2]])

    return { pathPoints: points, kfPoints: dots, color: selectedSource.color }
  }, [selectedSourceId, anim, animations, selectedSource])

  if (!pathPoints || !kfPoints) return null

  return (
    <group>
      <Line
        points={pathPoints}
        color={color}
        lineWidth={1.5}
        opacity={0.4}
        transparent
      />
      {kfPoints.map((pos, i) => (
        <mesh key={i} position={pos}>
          <sphereGeometry args={[0.06, 8, 8]} />
          <meshBasicMaterial color={color} opacity={0.7} transparent />
        </mesh>
      ))}
    </group>
  )
}
