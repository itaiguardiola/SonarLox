import { useRef, useEffect, useCallback } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { Vector3, Plane, Raycaster, type Mesh, type MeshStandardMaterial } from 'three'
import { useAppStore } from '../stores/useAppStore'
import { audioEngine } from '../audio/AudioEngine'
import type { SourceId } from '../types'

const BASE_SCALE = 0.3
const MAX_SCALE = 0.45
const BASE_EMISSIVE = 0.3
const MAX_EMISSIVE = 1.0
const SELECTED_EMISSIVE_BOOST = 0.4
const THROTTLE_MS = 64

const MIN_BOUNDS: [number, number, number] = [-10, 0, -10]
const MAX_BOUNDS: [number, number, number] = [10, 10, 10]

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v
}

interface SoundSourceProps {
  sourceId: SourceId
}

export function SoundSource({ sourceId }: SoundSourceProps) {
  const meshRef = useRef<Mesh>(null)
  const selectSource = useAppStore((s) => s.selectSource)
  const setSourcePosition = useAppStore((s) => s.setSourcePosition)
  const controls = useThree((s) => s.controls) as { enabled: boolean } | null
  const camera = useThree((s) => s.camera)
  const lastStoreUpdate = useRef(0)

  // Drag state
  const isDragging = useRef(false)
  const dragOffset = useRef(new Vector3())
  const dragPlane = useRef(new Plane())
  const hitPoint = useRef(new Vector3())
  const shiftHeld = useRef(false)

  const analyserRef = useRef<AnalyserNode | null>(null)
  const timeDomainRef = useRef<Uint8Array<ArrayBuffer> | null>(null)

  useEffect(() => {
    const analyser = audioEngine.getAnalyser(sourceId)
    analyserRef.current = analyser
    if (analyser) {
      timeDomainRef.current = new Uint8Array(analyser.fftSize)
    }
  })

  const getSource = useCallback(() => {
    return useAppStore.getState().sources.find((s) => s.id === sourceId)
  }, [sourceId])

  const commitPosition = useCallback(
    (x: number, y: number, z: number, force: boolean) => {
      const now = performance.now()
      if (force || now - lastStoreUpdate.current > THROTTLE_MS) {
        lastStoreUpdate.current = now
        setSourcePosition(sourceId, [x, y, z])
      }
    },
    [sourceId, setSourcePosition]
  )

  const onPointerDown = useCallback(
    (event: {
      stopPropagation: () => void
      pointerId: number
      target: EventTarget
      shiftKey: boolean
      ray: Raycaster['ray']
    }) => {
      event.stopPropagation()
      selectSource(sourceId)
      isDragging.current = true
      shiftHeld.current = event.shiftKey

      const el = event.target as HTMLElement
      if (el.setPointerCapture) el.setPointerCapture(event.pointerId)

      const source = getSource()
      if (!source) return
      const [sx, sy, sz] = source.position
      const spherePos = new Vector3(sx, sy, sz)

      if (event.shiftKey) {
        dragPlane.current.setFromNormalAndCoplanarPoint(
          new Vector3(0, 0, 1)
            .applyQuaternion(camera.quaternion)
            .setY(0)
            .normalize().length() > 0.01
            ? new Vector3(0, 0, 1)
                .applyQuaternion(camera.quaternion)
                .setY(0)
                .normalize()
            : new Vector3(0, 0, 1),
          spherePos
        )
      } else {
        dragPlane.current.setFromNormalAndCoplanarPoint(new Vector3(0, 1, 0), spherePos)
      }

      if (event.ray.intersectPlane(dragPlane.current, hitPoint.current)) {
        dragOffset.current.copy(hitPoint.current).sub(spherePos)
      } else {
        dragOffset.current.set(0, 0, 0)
      }

      if (controls) controls.enabled = false
    },
    [camera, controls, sourceId, selectSource, getSource]
  )

  const onPointerMove = useCallback(
    (event: {
      stopPropagation: () => void
      shiftKey: boolean
      ray: Raycaster['ray']
    }) => {
      if (!isDragging.current) return
      event.stopPropagation()

      const source = getSource()
      if (!source) return

      if (event.shiftKey !== shiftHeld.current) {
        shiftHeld.current = event.shiftKey
        const [sx, sy, sz] = source.position
        const spherePos = new Vector3(sx, sy, sz)
        if (event.shiftKey) {
          dragPlane.current.setFromNormalAndCoplanarPoint(
            new Vector3(0, 0, 1)
              .applyQuaternion(camera.quaternion)
              .setY(0)
              .normalize().length() > 0.01
              ? new Vector3(0, 0, 1)
                  .applyQuaternion(camera.quaternion)
                  .setY(0)
                  .normalize()
              : new Vector3(0, 0, 1),
            spherePos
          )
        } else {
          dragPlane.current.setFromNormalAndCoplanarPoint(new Vector3(0, 1, 0), spherePos)
        }
        if (event.ray.intersectPlane(dragPlane.current, hitPoint.current)) {
          dragOffset.current.copy(hitPoint.current).sub(spherePos)
        }
      }

      if (!event.ray.intersectPlane(dragPlane.current, hitPoint.current)) return

      const x = clamp(hitPoint.current.x - dragOffset.current.x, MIN_BOUNDS[0], MAX_BOUNDS[0])
      const y = clamp(hitPoint.current.y - dragOffset.current.y, MIN_BOUNDS[1], MAX_BOUNDS[1])
      const z = clamp(hitPoint.current.z - dragOffset.current.z, MIN_BOUNDS[2], MAX_BOUNDS[2])

      const [, curY] = source.position
      const [, , curZ] = source.position
      if (!shiftHeld.current) {
        commitPosition(x, curY, z, false)
      } else {
        commitPosition(x, y, curZ, false)
      }
    },
    [camera, commitPosition, getSource]
  )

  const onPointerUp = useCallback(
    (event: {
      stopPropagation: () => void
      pointerId: number
      target: EventTarget
    }) => {
      if (!isDragging.current) return
      isDragging.current = false

      const el = event.target as HTMLElement
      if (el.releasePointerCapture) {
        try {
          el.releasePointerCapture(event.pointerId)
        } catch {
          /* already released */
        }
      }

      if (controls) controls.enabled = true

      const source = getSource()
      if (source) {
        const [x, y, z] = source.position
        commitPosition(x, y, z, true)
      }
    },
    [controls, commitPosition, getSource]
  )

  useFrame(() => {
    const mesh = meshRef.current
    if (!mesh) return

    // Update position from store
    const source = getSource()
    if (source) {
      mesh.position.set(...source.position)
    }

    // Selected state
    const isSelected = useAppStore.getState().selectedSourceId === sourceId

    const analyser = analyserRef.current ?? audioEngine.getAnalyser(sourceId)
    if (!analyser) {
      const s = BASE_SCALE / 0.3
      mesh.scale.setScalar(s)
      const mat = mesh.material as MeshStandardMaterial
      mat.emissiveIntensity = isSelected ? BASE_EMISSIVE + SELECTED_EMISSIVE_BOOST : BASE_EMISSIVE
      return
    }

    if (!timeDomainRef.current) {
      analyserRef.current = analyser
      timeDomainRef.current = new Uint8Array(analyser.fftSize)
    }

    const data = timeDomainRef.current
    analyser.getByteTimeDomainData(data)

    let sumSq = 0
    for (let i = 0; i < data.length; i++) {
      const normalized = (data[i] - 128) / 128
      sumSq += normalized * normalized
    }
    const rms = Math.sqrt(sumSq / data.length)
    const amplitude = Math.min(rms * 3, 1)

    const targetScale = (BASE_SCALE + amplitude * (MAX_SCALE - BASE_SCALE)) / 0.3
    mesh.scale.setScalar(targetScale)

    const mat = mesh.material as MeshStandardMaterial
    const baseE = isSelected ? BASE_EMISSIVE + SELECTED_EMISSIVE_BOOST : BASE_EMISSIVE
    mat.emissiveIntensity = baseE + amplitude * (MAX_EMISSIVE - baseE)
  })

  // Get initial values for rendering
  const source = useAppStore((s) => s.sources.find((src) => src.id === sourceId))
  const color = source?.color ?? '#ff6622'
  const position = source?.position ?? [2, 1, 0]

  return (
    <mesh
      ref={meshRef}
      position={position}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <sphereGeometry args={[0.3, 32, 32]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} />
    </mesh>
  )
}
