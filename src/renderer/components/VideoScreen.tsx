import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import {
  Vector3,
  Plane,
  Raycaster,
  VideoTexture,
  SRGBColorSpace,
  LinearFilter,
  DoubleSide,
  type Mesh,
} from 'three'
import { useAppStore } from '../stores/useAppStore'

const THROTTLE_MS = 64

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v
}

interface VideoScreenProps {
  videoElement: HTMLVideoElement | null
}

export function VideoScreen({ videoElement }: VideoScreenProps) {
  const meshRef = useRef<Mesh>(null)
  const controls = useThree((s) => s.controls) as { enabled: boolean } | null
  const camera = useThree((s) => s.camera)
  const lastStoreUpdate = useRef(0)

  const isDragging = useRef(false)
  const dragOffset = useRef(new Vector3())
  const dragPlane = useRef(new Plane())
  const hitPoint = useRef(new Vector3())

  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!videoElement) { setReady(false); return }
    if (videoElement.readyState >= 2) { setReady(true); return }
    const onLoaded = () => setReady(true)
    videoElement.addEventListener('loadeddata', onLoaded)
    return () => videoElement.removeEventListener('loadeddata', onLoaded)
  }, [videoElement])

  const videoTexture = useMemo(() => {
    if (!videoElement || !ready) return null
    const tex = new VideoTexture(videoElement)
    tex.colorSpace = SRGBColorSpace
    tex.minFilter = LinearFilter
    tex.magFilter = LinearFilter
    return tex
  }, [videoElement, ready])

  // Dispose texture on unmount
  useEffect(() => {
    return () => {
      videoTexture?.dispose()
    }
  }, [videoTexture])

  const getScreenState = useCallback(() => {
    const s = useAppStore.getState()
    return {
      position: s.videoScreenPosition,
      locked: s.videoScreenLocked,
      scale: s.videoScreenScale,
      opacity: s.videoOpacity,
    }
  }, [])

  const commitPosition = useCallback(
    (x: number, y: number, z: number, force: boolean) => {
      const now = performance.now()
      if (force || now - lastStoreUpdate.current > THROTTLE_MS) {
        lastStoreUpdate.current = now
        useAppStore.getState().setVideoScreenPosition([x, y, z])
      }
    },
    []
  )

  const onPointerDown = useCallback(
    (event: {
      stopPropagation: () => void
      pointerId: number
      target: EventTarget
      ray: Raycaster['ray']
    }) => {
      const { locked } = getScreenState()
      if (locked) return

      event.stopPropagation()
      isDragging.current = true

      const el = event.target as HTMLElement
      if (el.setPointerCapture) el.setPointerCapture(event.pointerId)

      const { position } = getScreenState()
      const pos = new Vector3(...position)

      // Drag on a camera-facing vertical plane through the screen center
      const normal = new Vector3()
      camera.getWorldDirection(normal)
      normal.y = 0
      normal.normalize()
      if (normal.length() < 0.01) normal.set(0, 0, 1)
      dragPlane.current.setFromNormalAndCoplanarPoint(normal, pos)

      if (event.ray.intersectPlane(dragPlane.current, hitPoint.current)) {
        dragOffset.current.copy(hitPoint.current).sub(pos)
      } else {
        dragOffset.current.set(0, 0, 0)
      }

      if (controls) controls.enabled = false
    },
    [camera, controls, getScreenState]
  )

  const onPointerMove = useCallback(
    (event: {
      stopPropagation: () => void
      ray: Raycaster['ray']
    }) => {
      if (!isDragging.current) return
      event.stopPropagation()

      if (!event.ray.intersectPlane(dragPlane.current, hitPoint.current)) return

      const roomSize = useAppStore.getState().roomSize
      const halfW = roomSize[0] / 2
      const halfD = roomSize[1] / 2

      const x = clamp(hitPoint.current.x - dragOffset.current.x, -halfW, halfW)
      const y = clamp(hitPoint.current.y - dragOffset.current.y, 0.5, 10)
      const z = clamp(hitPoint.current.z - dragOffset.current.z, -halfD, halfD)

      commitPosition(x, y, z, false)
    },
    [commitPosition]
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
        } catch { /* already released */ }
      }

      if (controls) controls.enabled = true

      const { position } = getScreenState()
      commitPosition(...position, true)
    },
    [controls, commitPosition, getScreenState]
  )

  const visible = useAppStore((s) => s.videoScreenVisible)
  const hasVideo = useAppStore((s) => s.videoFilePath !== null)
  const locked = useAppStore((s) => s.videoScreenLocked)

  const shouldRender = hasVideo && visible && videoTexture !== null

  // Update mesh position and billboard rotation each frame
  useFrame(() => {
    const mesh = meshRef.current
    if (!mesh) return

    const { position, scale, opacity } = getScreenState()

    if (!isDragging.current) {
      mesh.position.set(...position)
    }

    // Billboard: face camera horizontally
    const camPos = camera.position
    const dx = camPos.x - mesh.position.x
    const dz = camPos.z - mesh.position.z
    mesh.rotation.y = Math.atan2(dx, dz)

    // Update scale (16:9 aspect)
    mesh.scale.set(scale, scale * (9 / 16), 1)

    // Update opacity
    const mat = mesh.material as import('three').MeshBasicMaterial
    if (mat.opacity !== opacity) {
      mat.opacity = opacity
      mat.transparent = opacity < 1
    }

    // Only update texture when video has frames
    if (videoTexture && videoElement && videoElement.readyState >= 2) {
      videoTexture.needsUpdate = true
    }
  })

  if (!shouldRender) return null

  const position = useAppStore.getState().videoScreenPosition

  return (
    <mesh
      ref={meshRef}
      position={position}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      raycast={locked ? () => {} : undefined}
    >
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        map={videoTexture}
        side={DoubleSide}
        toneMapped={false}
        transparent
      />
    </mesh>
  )
}
