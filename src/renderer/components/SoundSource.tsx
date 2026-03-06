import { useRef, useEffect, useCallback } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { Vector3, Plane, Raycaster, Color, type Mesh, type MeshStandardMaterial } from 'three'
import { useAppStore } from '../stores/useAppStore'
import { useTransportStore } from '../stores/useTransportStore'
import { audioEngine } from '../audio/WebAudioEngine'
import { getAnimatedPosition } from '../audio/AnimationEngine'
import type { SourceId } from '../types'
import { clamp, THROTTLE_MS } from '../utils/math'

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
  }, [sourceId])

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

        // Record keyframe if recording mode is active
        const { isRecordingKeyframes, setKeyframe } = useAppStore.getState()
        const transport = useTransportStore.getState()
        if (isRecordingKeyframes) {
          // Record at current playhead position even if stopped
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
      
      const source = getSource()
      if (!source) return

      selectSource(sourceId)
      // If synced, we can highlight/select logic

      isDragging.current = true
      shiftHeld.current = event.shiftKey

      const el = event.target as HTMLElement
      if (el.setPointerCapture) el.setPointerCapture(event.pointerId)

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

      // eslint-disable-next-line react-hooks/immutability -- R3F orbit controls toggle
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
    [camera, commitPosition, getSource, roomSize]
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

      // eslint-disable-next-line react-hooks/immutability -- R3F orbit controls toggle
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

    const state = useAppStore.getState()
    const isRecording = state.isRecordingKeyframes
    const transport = useTransportStore.getState()

    // Update position from store (or animated position during playback)
    const source = getSource()
    if (source && !isDragging.current) {
      const useAnimation = transport.isPlaying || transport.isPaused
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
    const isSelected = state.selectedSourceId === sourceId

    // Front/back color shift based on azimuth from listener (faces -Z)
    const azimuthAngle = Math.atan2(mesh.position.x, -mesh.position.z)
    const absAzimuth = Math.abs(azimuthAngle)
    const HALF_PI = Math.PI / 2

    const analyser = analyserRef.current ?? audioEngine.getAnalyser(sourceId)
    const mat = mesh.material as MeshStandardMaterial

    if (!analyser) {
      const s = BASE_SCALE / 0.3
      mesh.scale.setScalar(s)
      let baseE = isSelected ? BASE_EMISSIVE + SELECTED_EMISSIVE_BOOST : BASE_EMISSIVE

      // Add red pulse if recording
      if (isRecording) {
        const pulse = (Math.sin(performance.now() * 0.01) + 1) * 0.5
        mat.emissive.lerp(new Color('#ff0000'), pulse * 0.6)
        baseE += pulse * 0.3
      } else {
        // Apply front/back color shift
        if (absAzimuth > HALF_PI) {
          const t = Math.min((absAzimuth - HALF_PI) / HALF_PI, 1)
          tempColor.current.copy(baseColorRef.current).lerp(rearColorRef.current, t)
          mat.emissive.copy(tempColor.current)
        } else {
          mat.emissive.copy(baseColorRef.current)
        }
      }
      mat.emissiveIntensity = baseE
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

    let baseE = isSelected ? BASE_EMISSIVE + SELECTED_EMISSIVE_BOOST : BASE_EMISSIVE

    // Add red pulse if recording
    if (isRecording) {
      const pulse = (Math.sin(performance.now() * 0.01) + 1) * 0.5
      mat.emissive.lerp(new Color('#ff0000'), pulse * 0.6)
      baseE += pulse * 0.3
    } else {
      // Apply front/back color shift
      if (absAzimuth > HALF_PI) {
        const t = Math.min((absAzimuth - HALF_PI) / HALF_PI, 1)
        tempColor.current.copy(baseColorRef.current).lerp(rearColorRef.current, t)
        mat.emissive.copy(tempColor.current)
      } else {
        mat.emissive.copy(baseColorRef.current)
      }
    }

    mat.emissiveIntensity = baseE + amplitude * (MAX_EMISSIVE - baseE)
  })

  // Cache base and rear-shifted colors for front/back emissive shift
  const source = useAppStore((s) => s.sources.find((src) => src.id === sourceId))
  const color = source?.color ?? '#ff6622'
  const position = source?.position ?? [2, 1, 0]

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

/**
 * Renders small "ghost" markers for all keyframes of a source.
 * Helps users visualize the motion path in the 3D viewport.
 */
export function KeyframeGhosts({ sourceId }: { sourceId: SourceId }) {
  const animations = useAppStore((s) => s.animations)
  const source = useAppStore((s) => s.sources.find((src) => src.id === sourceId))
  const keyframes = animations[sourceId]?.keyframes ?? []
  
  if (keyframes.length === 0 || !source) return null

  return (
    <group>
      {keyframes.map((kf, i) => (
        <mesh key={`${sourceId}-ghost-${i}`} position={kf.position}>
          <sphereGeometry args={[0.06, 8, 8]} />
          <meshBasicMaterial 
            color={source.color} 
            transparent 
            opacity={0.3} 
          />
        </mesh>
      ))}
    </group>
  )
}
