import { useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard } from '@react-three/drei'
import { Color, type Mesh, type MeshBasicMaterial } from 'three'
import { audioEngine } from '../audio/AudioEngine'
import { useAppStore } from '../stores/useAppStore'

const BAR_COUNT = 16
const BAR_WIDTH = 0.06
const BAR_GAP = 0.02
const MAX_BAR_HEIGHT = 0.8
const Y_OFFSET = 0.6

const lowColor = new Color('#22cc44')
const highColor = new Color('#ff8800')

export function AudioVisualizer() {
  const sourcePosition = useAppStore((s) => s.sourcePosition)
  const barRefs = useRef<(Mesh | null)[]>([])
  const dataRef = useRef<Uint8Array<ArrayBuffer> | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const colorsRef = useRef<Color[]>(
    Array.from({ length: BAR_COUNT }, () => new Color())
  )

  useEffect(() => {
    const analyser = audioEngine.getAnalyser()
    analyserRef.current = analyser
    if (analyser) {
      dataRef.current = new Uint8Array(analyser.frequencyBinCount)
    }
  })

  useFrame(() => {
    const analyser = analyserRef.current ?? audioEngine.getAnalyser()
    if (!analyser) return

    if (!dataRef.current) {
      analyserRef.current = analyser
      dataRef.current = new Uint8Array(analyser.frequencyBinCount)
    }

    const data = dataRef.current
    analyser.getByteFrequencyData(data)

    const binCount = analyser.frequencyBinCount
    const step = Math.floor(binCount / BAR_COUNT)

    for (let i = 0; i < BAR_COUNT; i++) {
      const mesh = barRefs.current[i]
      if (!mesh) continue

      const value = data[i * step] / 255
      const height = Math.max(0.01, value * MAX_BAR_HEIGHT)

      mesh.scale.y = height
      mesh.position.y = height / 2

      const color = colorsRef.current[i]
      color.copy(lowColor).lerp(highColor, value)
      const mat = mesh.material as MeshBasicMaterial
      mat.color.copy(color)
    }
  })

  const totalWidth = BAR_COUNT * (BAR_WIDTH + BAR_GAP) - BAR_GAP
  const startX = -totalWidth / 2 + BAR_WIDTH / 2

  return (
    <group position={[sourcePosition[0], sourcePosition[1] + Y_OFFSET, sourcePosition[2]]}>
      <Billboard follow lockX={false} lockY={false} lockZ={false}>
        {Array.from({ length: BAR_COUNT }, (_, i) => (
          <mesh
            key={i}
            ref={(el) => { barRefs.current[i] = el }}
            position={[startX + i * (BAR_WIDTH + BAR_GAP), 0, 0]}
          >
            <boxGeometry args={[BAR_WIDTH, 1, BAR_WIDTH]} />
            <meshBasicMaterial color={lowColor} />
          </mesh>
        ))}
      </Billboard>
    </group>
  )
}
