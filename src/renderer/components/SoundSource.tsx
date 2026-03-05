import { useRef, useEffect, useCallback } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { Vector3, Plane, Raycaster, Color, type Mesh, type MeshStandardMaterial } from 'three'
import { useAppStore } from '../stores/useAppStore'
import { useTransportStore } from '../stores/useTransportStore'
import { audioEngine } from '../audio/WebAudioEngine'
import { getAnimatedPosition } from '../audio/AnimationEngine'
import type { SourceId } from '../types'

/**
 * Base scale factor for sound source spheres
 */
const BASE_SCALE = 0.3

/**
 * Maximum scale factor for sound source spheres during audio playback
 */
const MAX_SCALE = 0.45

/**
 * Base emissive intensity for sound source spheres
 */
const BASE_EMISSIVE = 0.3

/**
 * Maximum emissive intensity for sound source spheres during audio playback
 */
const MAX_EMISSIVE = 1.0

/**
 * Additional emissive boost when a sound source is selected
 */
const SELECTED_EMISSIVE_BOOST = 0.4

/**
 * Throttle interval for position updates to avoid excessive store writes
 */
const THROTTLE_MS = 64

/**
 * Minimum bounds for sound source positions in 3D space
 */
const MIN_BOUNDS: [number, number, number] = [-10, 0, -10]

/**
 * Maximum bounds for sound source positions in 3D space
 */
const MAX_BOUNDS: [number, number, number] = [10, 10, 10]

/**
 * Clamps a value between a minimum and maximum
 */
function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v
}

/**
 * Props for the SoundSource component
 */
interface SoundSourceProps {
  sourceId: SourceId
}

/**
 * A 3D visual representation of a sound source in the spatial audio editor
 * Supports dragging, selection, and dynamic scaling/visual feedback based on audio amplitude
 */
export function SoundSource({ sourceId }: SoundSourceProps) {
  const meshRef = useRef<Mesh>(null)
  const selectSource = useAppStore((s) => s.selectSource)
  const setSourcePosition = useAppStore((s) => s.setSourcePosition)
  const roomSize = useAppStore((s) => s.roomSize)
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
  const baseColorRef = useRef(new Color())
  const rearColorRef = useRef(new Color())
  const tempColor = useRef(new Color())

  useEffect(() => {
    const analyser = audioEngine.getAnalyser(sourceId)
    analyserRef.current = analyser
    if (analyser) {
      timeDomainRef.current = new Uint8Array(analyser.fftSize)
    }
  })

  /**
   * Retrieves the current source data from the store
   */
  const getSource = useCallback(() => {
    return useAppStore.getState().sources.find((s) => s.id === sourceId)
  }, [sourceId])

  /**
   * Commits a new position to the store with throttling
   */
  const commitPosition = useCallback(
    (x: number, y: number, z: number, force: boolean) => {
      const now = performance.now()
      if (force || now - lastStoreUpdate.current > THROTTLE_MS) {
        lastStoreUpdate.current = now
        setSourcePosition(sourceId, [x, y, z])

        // Record keyframe if recording during playback
        const { isRecordingKeyframes, setKeyframe } = useAppStore.getState()
        const transport = useTransportStore.getState()
        if (isRecordingKeyframes && transport.isPlaying) {
          setKeyframe(sourceId, transport.playheadPosition, [x, y, z])
        }
      }
    },
    [sourceId, setSourcePosition]
  )

  /**
   * Handles pointer down event for dragging sound sources
   */
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

  /**
   * Handles pointer move event during dragging
   */
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

      const [width, depth] = roomSize
      const minX = -width / 2
      const maxX = width / 2
      const minZ = -depth / 2
      const maxZ = depth / 2

      const x = clamp(hitPoint.current.x - dragOffset.current.x, minX, maxX)
      const y = clamp(hitPoint.current.y - dragOffset.current.y, 0, 10)
      const z = clamp(hitPoint.current.z - dragOffset.current.z, minZ, maxZ)

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

  /**
   * Handles pointer up event to finish dragging
   */
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
        useAppStore.getState().recordHistory('Move source')
        commitPosition(x, y, z, true)
      }
    },
    [controls, commitPosition, getSource]
  )

  useFrame(() => {
    const mesh = meshRef.current
    if (!mesh) return

    // Update position from store (or animated position during playback)
    const source = getSource()
    if (source && !isDragging.current) {
      const transport = useTransportStore.getState()
      const useAnimation = transport.isPlaying || transport.isPaused
      const state = useAppStore.getState()
      if (useAnimation && state.animations[sourceId]?.keyframes.length) {
        const pos = getAnimatedPosition(sourceId, transport.playheadPosition, state.animations, source.position)
        mesh.position.set(...pos)
      } else {
        mesh.position.set(...source.position)
      }
    } else if (source) {
      mesh.position.set(...source.position)
    }

    // Selected state
    const isSelected = useAppStore.getState().selectedSourceId === sourceId

    // Front/back color shift based on azimuth from listener (faces -Z)
    const azimuthAngle = Math.atan2(mesh.position.x, -mesh.position.z)
    const absAzimuth = Math.abs(azimuthAngle)
    const HALF_PI = Math.PI / 2

    const analyser = analyserRef.current ?? audioEngine.getAnalyser(sourceId)
    if (!analyser) {
      const s = BASE_SCALE / 0.3
      mesh.scale.setScalar(s)
      const mat = mesh.material as MeshStandardMaterial
      mat.emissiveIntensity = isSelected ? BASE_EMISSIVE + SELECTED_EMISSIVE_BOOST : BASE_EMISSIVE
      if (absAzimuth > HALF_PI) {
        const t = Math.min((absAzimuth - HALF_PI) / HALF_PI, 1)
        tempColor.current.copy(baseColorRef.current).lerp(rearColorRef.current, t)
        mat.emissive.copy(tempColor.current)
      } else {
        mat.emissive.copy(baseColorRef.current)
      }
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

    // Apply front/back color shift
    if (absAzimuth > HALF_PI) {
      const t = Math.min((absAzimuth - HALF_PI) / HALF_PI, 1)
      tempColor.current.copy(baseColorRef.current).lerp(rearColorRef.current, t)
      mat.emissive.copy(tempColor.current)
    } else {
      mat.emissive.copy(baseColorRef.current)
    }
  })

  // Get initial values for rendering
  const source = useAppStore((s) => s.sources.find((src) => src.id === sourceId))
  const color = source?.color ?? '#ff6622'
  const position = source?.position ?? [2, 1, 0]

  // Cache base and rear-shifted colors for front/back emissive shift
  useEffect(() => {
    baseColorRef.current.set(color)
    // Desaturated blue-shifted version for rear hemisphere
    const hsl = { h: 0, s: 0, l: 0 }
    baseColorRef.current.getHSL(hsl)
    rearColorRef.current.setHSL(
      hsl.h * 0.6 + 0.6 * 0.65, // shift hue toward blue (0.65)
      hsl.s * 0.4,               // desaturate
      hsl.l * 0.7                // slightly darker
    )
  }, [color])

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
