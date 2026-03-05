import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import { Vector3, BufferGeometry, Float32BufferAttribute, LineBasicMaterial, Color, Line as ThreeLine } from 'three'
import { useAppStore } from '../stores/useAppStore'
import type { Line2 } from 'three-stdlib'

/**
 * Array of ring radii used for distance visualization in the spatial audio editor
 */
const RING_RADII = [2, 4, 6, 8]

/**
 * Number of segments used to create circular rings
 */
const RING_SEGMENTS = 64

/**
 * Color used for inactive distance rings
 */
const INACTIVE_COLOR = new Color('#556677')

/**
 * Color used for active distance rings
 */
const ACTIVE_COLOR = new Color('#00ccff')

/**
 * Generates points for a circle with the specified radius
 * @param radius - The radius of the circle to generate
 * @returns An array of Vector3 points forming a circle
 */
function makeCirclePoints(radius: number): Vector3[] {
  const points: Vector3[] = []
  for (let i = 0; i <= RING_SEGMENTS; i++) {
    const angle = (i / RING_SEGMENTS) * Math.PI * 2
    points.push(new Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius))
  }
  return points
}

/**
 * Renders distance rings and projection line for the selected audio source
 * Visualizes the distance of the selected source from the listener using concentric rings
 * and a projection line showing the horizontal distance to the listener
 */
export function DistanceRings() {
  const ringRefs = useRef<(Line2 | null)[]>([])

  const projPositions = useMemo(() => new Float32Array(6), [])
  const projGeometry = useMemo(() => {
    const geo = new BufferGeometry()
    geo.setAttribute('position', new Float32BufferAttribute(projPositions, 3))
    return geo
  }, [projPositions])
  const projMaterial = useMemo(
    () => new LineBasicMaterial({ color: '#00ccff', opacity: 0.5, transparent: true }),
    []
  )
  const projLine = useMemo(
    () => new ThreeLine(projGeometry, projMaterial),
    [projGeometry, projMaterial]
  )

  const circles = useMemo(
    () => RING_RADII.map((r) => makeCirclePoints(r)),
    []
  )

  useFrame(() => {
    const state = useAppStore.getState()
    const selected = state.sources.find((s) => s.id === state.selectedSourceId)
    if (!selected) return

    const [x, y, z] = selected.position
    const distance = Math.sqrt(x * x + y * y + z * z)

    let closestIndex = 0
    let bestDiff = Math.abs(RING_RADII[0] - distance)
    for (let i = 1; i < RING_RADII.length; i++) {
      const diff = Math.abs(RING_RADII[i] - distance)
      if (diff < bestDiff) {
        bestDiff = diff
        closestIndex = i
      }
    }

    for (let i = 0; i < ringRefs.current.length; i++) {
      const line = ringRefs.current[i]
      if (!line) continue
      const mat = line.material
      const isActive = i === closestIndex
      mat.color.copy(isActive ? ACTIVE_COLOR : INACTIVE_COLOR)
      mat.opacity = isActive ? 0.8 : 0.3
      mat.linewidth = isActive ? 1.5 : 0.8
    }

    // R3F transient update — mutating typed array for GPU upload, not React state
    /* eslint-disable react-hooks/immutability */
    projPositions[3] = x
    projPositions[4] = 0
    projPositions[5] = z
    projGeometry.attributes.position.needsUpdate = true
    /* eslint-enable react-hooks/immutability */
  })

  return (
    <group>
      {circles.map((points, i) => (
        <Line
          key={i}
          ref={(el: Line2 | null) => { ringRefs.current[i] = el }}
          points={points}
          color={INACTIVE_COLOR}
          lineWidth={0.8}
          opacity={0.3}
          transparent
        />
      ))}
      <primitive object={projLine} />
    </group>
  )
}
