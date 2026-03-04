import { useRef, useEffect } from 'react'
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

export function SoundSource() {
  const meshRef = useRef<Mesh>(null)
  const sourcePosition = useAppStore((s) => s.sourcePosition)
  const setSourcePosition = useAppStore((s) => s.setSourcePosition)
  const controls = useThree((s) => s.controls) as { enabled: boolean } | null

  const analyserRef = useRef<AnalyserNode | null>(null)
  const timeDomainRef = useRef<Uint8Array<ArrayBuffer> | null>(null)

  useEffect(() => {
    const analyser = audioEngine.getAnalyser()
    analyserRef.current = analyser
    if (analyser) {
      timeDomainRef.current = new Uint8Array(analyser.fftSize)
    }
  })

  useFrame(() => {
    const mesh = meshRef.current
    if (!mesh) return

    const analyser = analyserRef.current ?? audioEngine.getAnalyser()
    if (!analyser) {
      // No audio: reset to base
      const s = BASE_SCALE / 0.3 // geometry radius is 0.3, scale 1 = radius 0.3
      mesh.scale.setScalar(s)
      return
    }

    if (!timeDomainRef.current) {
      analyserRef.current = analyser
      timeDomainRef.current = new Uint8Array(analyser.fftSize)
    }

    const data = timeDomainRef.current
    analyser.getByteTimeDomainData(data)

    // Compute RMS
    let sumSq = 0
    for (let i = 0; i < data.length; i++) {
      const normalized = (data[i] - 128) / 128
      sumSq += normalized * normalized
    }
    const rms = Math.sqrt(sumSq / data.length)
    const amplitude = Math.min(rms * 3, 1) // scale up, clamp to 1

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
      }}
      onDrag={(localMatrix: Matrix4) => {
        if (!meshRef.current) return
        _pos.setFromMatrixPosition(localMatrix)
        meshRef.current.position.copy(_pos)
        setSourcePosition([_pos.x, _pos.y, _pos.z])
      }}
    >
      <mesh ref={meshRef} position={sourcePosition}>
        <sphereGeometry args={[0.3, 32, 32]} />
        <meshStandardMaterial color="#ff6622" emissive="#ff6622" emissiveIntensity={0.3} />
      </mesh>
    </DragControls>
  )
}
