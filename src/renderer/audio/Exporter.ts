import { encodeWav } from './encodeWav'
import { getAnimatedPositionsAtIntervals } from './AnimationEngine'
import type { SourceId, SourceAnimation } from '../types'

const SCHEDULE_INTERVAL_MS = 20

/**
 * Schedules position automation for a PannerNode based on source animations.
 * Used to animate spatial position over time in binaural rendering.
 */
function schedulePositionAutomation(
  pannerNode: PannerNode,
  sourceId: SourceId,
  animations: Record<SourceId, SourceAnimation>,
  position: [number, number, number],
  duration: number,
): void {
  const anim = animations[sourceId]
  if (!anim || anim.keyframes.length === 0) return

  const samples = getAnimatedPositionsAtIntervals(
    sourceId, duration, animations, position, SCHEDULE_INTERVAL_MS / 1000
  )
  for (const s of samples) {
    pannerNode.positionX.setValueAtTime(s.position[0], s.time)
    pannerNode.positionY.setValueAtTime(s.position[1], s.time)
    pannerNode.positionZ.setValueAtTime(s.position[2], s.time)
  }
}

/**
 * Exports a binaural WAV file for a single audio source with spatial positioning.
 * Uses HRTF panning and supports keyframe animation for position changes.
 */
export async function exportBinauralWav(
  audioBuffer: AudioBuffer,
  position: [number, number, number],
  volume: number,
  listenerY = 0,
  sourceId?: SourceId,
  animations?: Record<SourceId, SourceAnimation>,
): Promise<ArrayBuffer> {
  const sampleRate = 44100
  const length = Math.ceil(audioBuffer.duration * sampleRate)
  const offlineCtx = new OfflineAudioContext(2, length, sampleRate)

  offlineCtx.listener.positionY.value = listenerY

  const source = offlineCtx.createBufferSource()
  source.buffer = audioBuffer

  const gainNode = offlineCtx.createGain()
  gainNode.gain.value = volume

  const pannerNode = offlineCtx.createPanner()
  pannerNode.panningModel = 'HRTF'
  pannerNode.distanceModel = 'inverse'
  pannerNode.refDistance = 1
  pannerNode.maxDistance = 50
  pannerNode.rolloffFactor = 1
  pannerNode.positionX.value = position[0]
  pannerNode.positionY.value = position[1]
  pannerNode.positionZ.value = position[2]

  // Schedule position automation if keyframes exist
  if (sourceId && animations) {
    schedulePositionAutomation(pannerNode, sourceId, animations, position, audioBuffer.duration)
  }

  source.connect(gainNode)
  gainNode.connect(pannerNode)
  pannerNode.connect(offlineCtx.destination)

  source.start()
  const rendered = await offlineCtx.startRendering()
  return encodeWav(rendered)
}

/**
 * Interface for defining a source to be exported in binaural mixing.
 * Contains audio buffer, spatial position, and volume settings.
 */
export interface ExportSource {
  audioBuffer: AudioBuffer
  position: [number, number, number]
  volume: number
  sourceId?: SourceId
}

/**
 * Exports a mixed binaural WAV file from multiple audio sources.
 * Combines multiple sources with individual spatial positions and animations.
 */
export async function exportMixedBinauralWav(
  sources: ExportSource[],
  listenerY = 0,
  animations?: Record<SourceId, SourceAnimation>,
): Promise<ArrayBuffer> {
  if (sources.length === 0) throw new Error('No sources to export')

  const sampleRate = 44100
  const maxDuration = Math.max(...sources.map((s) => s.audioBuffer.duration))
  const length = Math.ceil(maxDuration * sampleRate)
  const offlineCtx = new OfflineAudioContext(2, length, sampleRate)

  offlineCtx.listener.positionY.value = listenerY

  for (const src of sources) {
    const source = offlineCtx.createBufferSource()
    source.buffer = src.audioBuffer

    const gainNode = offlineCtx.createGain()
    gainNode.gain.value = src.volume

    const pannerNode = offlineCtx.createPanner()
    pannerNode.panningModel = 'HRTF'
    pannerNode.distanceModel = 'inverse'
    pannerNode.refDistance = 1
    pannerNode.maxDistance = 50
    pannerNode.rolloffFactor = 1
    pannerNode.positionX.value = src.position[0]
    pannerNode.positionY.value = src.position[1]
    pannerNode.positionZ.value = src.position[2]

    if (src.sourceId && animations) {
      schedulePositionAutomation(pannerNode, src.sourceId, animations, src.position, src.audioBuffer.duration)
    }

    source.connect(gainNode)
    gainNode.connect(pannerNode)
    pannerNode.connect(offlineCtx.destination)

    source.start()
  }

  const rendered = await offlineCtx.startRendering()
  return encodeWav(rendered)
}

// ITU 5.1 speaker layout sorted by angle for VBAP pair-finding.
// Channel order in output: FL(0), FR(1), C(2), LFE(3), SL(4), SR(5)
// Speakers sorted clockwise: SR(-110), FR(-30), C(0), FL(30), SL(110)
const SPEAKERS_SORTED = [
  { angle: (-110 * Math.PI) / 180, outIndex: 5 }, // SR
  { angle: (-30 * Math.PI) / 180, outIndex: 1 },  // FR
  { angle: 0, outIndex: 2 },                       // C
  { angle: (30 * Math.PI) / 180, outIndex: 0 },    // FL
  { angle: (110 * Math.PI) / 180, outIndex: 4 },   // SL
]

/**
 * Computes 5.1 speaker gains for a given 3D position using VBAP (Vector Base Amplitude Panning).
 * Calculates spatial distribution across 6 speakers based on source angle and distance.
 */
function compute51Gains(position: [number, number, number]): number[] {
  const [x, , z] = position
  // Source angle from listener: atan2 gives (-PI, PI], 0 = front
  const sourceAngle = Math.atan2(x, -z)

  // Distance attenuation (inverse distance, refDistance=1, rolloff=1)
  const dist = Math.sqrt(x * x + position[1] * position[1] + z * z)
  const attenuation = 1 / Math.max(1, dist)

  const gains = [0, 0, 0, 0, 0, 0]
  const n = SPEAKERS_SORTED.length

  // VBAP: find the adjacent speaker pair that brackets the source angle.
  // Speakers are sorted by angle. The last-to-first pair wraps around
  // through the rear (+/-180 degrees), covering sources behind the listener.
  let found = false
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    const a1 = SPEAKERS_SORTED[i].angle
    const a2 = SPEAKERS_SORTED[j].angle

    // Check if sourceAngle is between a1 and a2 (handling wrap-around)
    let lo = a1
    let hi = a2
    let angle = sourceAngle
    if (j === 0) {
      // Wrap-around pair (SL to SR through the rear)
      // Shift angles so the gap doesn't cross the discontinuity
      lo = a1 - 2 * Math.PI // SL shifted to negative
      if (sourceAngle > a1) {
        angle = sourceAngle - 2 * Math.PI
      }
    }

    if ((lo <= angle && angle <= hi) || Math.abs(angle - lo) < 1e-6 || Math.abs(angle - hi) < 1e-6) {
      // Solve VBAP: [cos(a1) cos(a2); sin(a1) sin(a2)] * [g1; g2] = [cos(src); sin(src)]
      const ca1 = Math.cos(a1), sa1 = Math.sin(a1)
      const ca2 = Math.cos(a2), sa2 = Math.sin(a2)
      const cs = Math.cos(sourceAngle), ss = Math.sin(sourceAngle)

      const det = ca1 * sa2 - ca2 * sa1
      if (Math.abs(det) < 1e-9) {
        // Degenerate -- source is on a speaker, assign fully to nearest
        const d1 = Math.abs(sourceAngle - a1)
        const d2 = Math.abs(sourceAngle - a2)
        gains[SPEAKERS_SORTED[d1 <= d2 ? i : j].outIndex] = attenuation
      } else {
        const g1 = Math.max(0, (sa2 * cs - ca2 * ss) / det)
        const g2 = Math.max(0, (-sa1 * cs + ca1 * ss) / det)
        const sum = g1 + g2
        if (sum > 0) {
          gains[SPEAKERS_SORTED[i].outIndex] = (g1 / sum) * attenuation
          gains[SPEAKERS_SORTED[j].outIndex] = (g2 / sum) * attenuation
        }
      }
      found = true
      break
    }
  }

  // Fallback: nearest speaker (should not happen with correct bracket logic)
  if (!found) {
    let bestIdx = 0
    let bestDist = Infinity
    for (let i = 0; i < n; i++) {
      const d = Math.abs(sourceAngle - SPEAKERS_SORTED[i].angle)
      if (d < bestDist) { bestDist = d; bestIdx = i }
    }
    gains[SPEAKERS_SORTED[bestIdx].outIndex] = attenuation
  }

  // LFE: constant 0.5 scaled by distance
  gains[3] = 0.5 * attenuation

  return gains
}

/**
 * Schedules gain automation for 5.1 speaker outputs based on source animations.
 * Updates gain values over time for each speaker channel during playback.
 */
function schedule51GainAutomation(
  gainNodes: GainNode[],
  sourceId: SourceId,
  animations: Record<SourceId, SourceAnimation>,
  position: [number, number, number],
  volume: number,
  listenerY: number,
  duration: number,
): void {
  const anim = animations[sourceId]
  if (!anim || anim.keyframes.length === 0) return

  const samples = getAnimatedPositionsAtIntervals(
    sourceId, duration, animations, position, SCHEDULE_INTERVAL_MS / 1000
  )
  for (const s of samples) {
    const adjusted: [number, number, number] = [s.position[0], s.position[1] - listenerY, s.position[2]]
    const gains = compute51Gains(adjusted)
    for (let ch = 0; ch < 6; ch++) {
      gainNodes[ch].gain.setValueAtTime(volume * gains[ch], s.time)
    }
  }
}

/**
 * Exports a 5.1 WAV file for a single audio source with spatial positioning.
 * Uses VBAP panning and supports keyframe animation for speaker gains.
 */
export async function export51WavSingle(
  audioBuffer: AudioBuffer,
  position: [number, number, number],
  volume: number,
  listenerY = 0,
  sourceId?: SourceId,
  animations?: Record<SourceId, SourceAnimation>,
): Promise<ArrayBuffer> {
  const sampleRate = 44100
  const length = Math.ceil(audioBuffer.duration * sampleRate)
  const offlineCtx = new OfflineAudioContext(6, length, sampleRate)

  const adjustedPosition: [number, number, number] = [
    position[0],
    position[1] - listenerY,
    position[2],
  ]

  const gains = compute51Gains(adjustedPosition)
  const merger = offlineCtx.createChannelMerger(6)
  const gainNodes: GainNode[] = []

  for (let ch = 0; ch < 6; ch++) {
    const source = offlineCtx.createBufferSource()
    source.buffer = audioBuffer

    const gainNode = offlineCtx.createGain()
    gainNode.gain.value = volume * gains[ch]
    gainNodes.push(gainNode)

    // LFE channel: apply 120Hz lowpass
    if (ch === 3) {
      const lpf = offlineCtx.createBiquadFilter()
      lpf.type = 'lowpass'
      lpf.frequency.value = 120
      source.connect(gainNode)
      gainNode.connect(lpf)
      lpf.connect(merger, 0, ch)
    } else {
      source.connect(gainNode)
      gainNode.connect(merger, 0, ch)
    }

    source.start()
  }

  if (sourceId && animations) {
    schedule51GainAutomation(gainNodes, sourceId, animations, position, volume, listenerY, audioBuffer.duration)
  }

  merger.connect(offlineCtx.destination)

  const rendered = await offlineCtx.startRendering()
  return encodeWav(rendered)
}

/**
 * Exports a mixed 5.1 WAV file from multiple audio sources.
 * Combines multiple sources with individual spatial positions and animations.
 */
export async function export51Wav(
  sources: ExportSource[],
  listenerY = 0,
  animations?: Record<SourceId, SourceAnimation>,
): Promise<ArrayBuffer> {
  if (sources.length === 0) throw new Error('No sources to export')

  const sampleRate = 44100
  const maxDuration = Math.max(...sources.map((s) => s.audioBuffer.duration))
  const length = Math.ceil(maxDuration * sampleRate)
  const offlineCtx = new OfflineAudioContext(6, length, sampleRate)

  const merger = offlineCtx.createChannelMerger(6)

  for (const src of sources) {
    const adjustedPosition: [number, number, number] = [
      src.position[0],
      src.position[1] - listenerY,
      src.position[2],
    ]

    const gains = compute51Gains(adjustedPosition)
    const gainNodes: GainNode[] = []

    for (let ch = 0; ch < 6; ch++) {
      const source = offlineCtx.createBufferSource()
      source.buffer = src.audioBuffer

      const gainNode = offlineCtx.createGain()
      gainNode.gain.value = src.volume * gains[ch]
      gainNodes.push(gainNode)

      if (ch === 3) {
        const lpf = offlineCtx.createBiquadFilter()
        lpf.type = 'lowpass'
        lpf.frequency.value = 120
        source.connect(gainNode)
        gainNode.connect(lpf)
        lpf.connect(merger, 0, ch)
      } else {
        source.connect(gainNode)
        gainNode.connect(merger, 0, ch)
      }

      source.start()
    }

    if (src.sourceId && animations) {
      schedule51GainAutomation(gainNodes, src.sourceId, animations, src.position, src.volume, listenerY, src.audioBuffer.duration)
    }
  }

  merger.connect(offlineCtx.destination)

  const rendered = await offlineCtx.startRendering()
  return encodeWav(rendered)
}
