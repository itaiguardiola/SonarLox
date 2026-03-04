import { useMemo } from 'react'
import { Line } from '@react-three/drei'
import { Vector3 } from 'three'
import { useAppStore } from '../stores/useAppStore'

const RING_RADII = [2, 4, 6, 8]
const RING_SEGMENTS = 64
const INACTIVE_COLOR = '#556677'
const ACTIVE_COLOR = '#00ccff'
const LINE_COLOR = '#00ccff'

function makeCirclePoints(radius: number): Vector3[] {
  const points: Vector3[] = []
  for (let i = 0; i <= RING_SEGMENTS; i++) {
    const angle = (i / RING_SEGMENTS) * Math.PI * 2
    points.push(new Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius))
  }
  return points
}

export function DistanceRings() {
  const sourcePosition = useAppStore((s) => s.sourcePosition)
  const [x, y, z] = sourcePosition

  const distance = Math.sqrt(x * x + y * y + z * z)

  const closestIndex = useMemo(() => {
    let best = 0
    let bestDiff = Math.abs(RING_RADII[0] - distance)
    for (let i = 1; i < RING_RADII.length; i++) {
      const diff = Math.abs(RING_RADII[i] - distance)
      if (diff < bestDiff) {
        bestDiff = diff
        best = i
      }
    }
    return best
  }, [distance])

  const circles = useMemo(
    () => RING_RADII.map((r) => makeCirclePoints(r)),
    []
  )

  const groundTarget = useMemo(() => [new Vector3(0, 0, 0), new Vector3(x, 0, z)], [x, z])

  return (
    <group>
      {circles.map((points, i) => (
        <Line
          key={i}
          points={points}
          color={i === closestIndex ? ACTIVE_COLOR : INACTIVE_COLOR}
          lineWidth={i === closestIndex ? 1.5 : 0.8}
          opacity={i === closestIndex ? 0.8 : 0.3}
          transparent
        />
      ))}
      <Line
        points={groundTarget}
        color={LINE_COLOR}
        lineWidth={1}
        opacity={0.5}
        transparent
        dashed
        dashSize={0.3}
        gapSize={0.15}
      />
    </group>
  )
}
