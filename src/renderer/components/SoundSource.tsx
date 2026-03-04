import { useRef, useEffect, useCallback } from 'react'
import { DragControls } from '@react-three/drei'
import { useThree, useFrame } from '@react-three/fiber'
import { Vector3, type Mesh, type Matrix4, type MeshStandardMaterial } from 'three'
import { useAppStore } from '../stores/useAppStore'
import { audioEngine } from '../audio/AudioEngine'

const _pos = new Vector3()
const BASE_SCALE = 0.3
const MAX_SCALE = 0.45
const BASE_EMISSIVE = 0.3
const MAX_EMISSIVE = 1.0
const THROTTLE_MS = 64 // ~15hz store updates during drag for UI readout

export function SoundSource() {
  const meshRef = useRef<Mesh>(null)
  const setSourcePosition = useAppStore((s) => s.setSourcePosition)
  const controls = useThree((s) => s.controls) as { enabled: boolean } | null
  const lastStoreUpdate = useRef(0)

  // Read once for initial position prop (not a subscription -- no re-renders)
  const initialPosition = useRef(useAppStore.getState().sourcePosition).current

  const analyserRef = useRef<AnalyserNode | null>(null)
  const timeDomainRef = useRef<Uint8Array<ArrayBuffer> | null>(null)

  useEffect(() => {
    const analyser = audioEngine.getAnalyser()
    analyserRef.current = analyser
    if (analyser) {
      timeDomainRef.current = new Uint8Array(analyser.fftSize)
    }
  })

  // Throttled store commit during drag
  const commitPosition = useCallback((x: number, y: number, z: number, force: boolean) => {
    const now = performance.now()
    if (force || now - lastStoreUpdate.current > THROTTLE_MS) {
      lastStoreUpdate.current = now
      setSourcePosition([x, y, z])
    }
  }, [setSourcePosition])

  useFrame(() => {
    const mesh = meshRef.current
    if (!mesh) return

    const analyser = analyserRef.current ?? audioEngine.getAnalyser()
    if (!analyser) {
      const s = BASE_SCALE / 0.3
      mesh.scale.setScalar(s)
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
    mat.emissiveIntensity = BASE_EMISSIVE + amplitude * (MAX_EMISSIVE - BASE_EMISSIVE)
  })

  return (
    <DragControls
      autoTransform={false}
      dragLimits={[[-10, 10], [0, 10], [-10, 10]]}
      onDragStart={() => {
        if (controls) controls.enabled = false
      }}
      onDragEnd={() => {
        if (controls) controls.enabled = true
        // Final commit to store on drag end
        if (meshRef.current) {
          const p = meshRef.current.position
          commitPosition(p.x, p.y, p.z, true)
        }
      }}
      onDrag={(localMatrix: Matrix4) => {
        if (!meshRef.current) return
        _pos.setFromMatrixPosition(localMatrix)
        meshRef.current.position.copy(_pos)
        // Throttled store update for UI readout (ControlPanel position display)
        commitPosition(_pos.x, _pos.y, _pos.z, false)
      }}
    >
      <mesh ref={meshRef} position={initialPosition}>
        <sphereGeometry args={[0.3, 32, 32]} />
        <meshStandardMaterial color="#ff6622" emissive="#ff6622" emissiveIntensity={0.3} />
      </mesh>
    </DragControls>
  )
}
