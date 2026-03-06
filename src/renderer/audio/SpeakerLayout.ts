import type { SourcePosition } from '../types'

export interface Speaker {
  /** Label for display (e.g. "FL", "SR", "Top Front Left") */
  label: string
  /** 3D position in the same coordinate space as sources (meters from origin) */
  position: SourcePosition
  /** Output channel index in the rendered multichannel buffer */
  channelIndex: number
  /** If true, this speaker receives low-passed content only (LFE) */
  isLFE?: boolean
}

export interface SpeakerLayout {
  /** Human-readable name (e.g. "ITU 5.1", "7.1.4 Atmos Bed") */
  name: string
  /** Unique identifier for serialization */
  id: string
  /** Ordered array of speakers */
  speakers: Speaker[]
  /** Total output channel count (may exceed speakers.length if layout reserves channels) */
  channelCount: number
  /** LFE crossover frequency in Hz. If undefined, no LFE processing. */
  lfeCrossoverHz?: number
}

/**
 * Convert polar coordinates (azimuth, elevation, distance) to Cartesian [x, y, z].
 * Convention: 0 azimuth = front, positive = left, negative = right.
 * +x = right in Web Audio PannerNode frame; VBAP is self-consistent
 * (same convention for both source and speaker positions).
 */
function speakerFromPolar(azimuthDeg: number, elevationDeg: number, distance: number): SourcePosition {
  const az = (azimuthDeg * Math.PI) / 180
  const el = (elevationDeg * Math.PI) / 180
  const x = distance * Math.cos(el) * Math.sin(az)
  const y = distance * Math.sin(el)
  const z = -distance * Math.cos(el) * Math.cos(az)
  return [x, y, z]
}

const MONITOR_DISTANCE = 2

export function createStereoLayout(): SpeakerLayout {
  return {
    name: 'Stereo',
    id: 'stereo',
    speakers: [
      { label: 'L', position: speakerFromPolar(30, 0, MONITOR_DISTANCE), channelIndex: 0 },
      { label: 'R', position: speakerFromPolar(-30, 0, MONITOR_DISTANCE), channelIndex: 1 },
    ],
    channelCount: 2,
  }
}

export function createLayout51(): SpeakerLayout {
  return {
    name: 'ITU 5.1',
    id: '5.1',
    speakers: [
      { label: 'FL', position: speakerFromPolar(30, 0, MONITOR_DISTANCE), channelIndex: 0 },
      { label: 'FR', position: speakerFromPolar(-30, 0, MONITOR_DISTANCE), channelIndex: 1 },
      { label: 'C', position: speakerFromPolar(0, 0, MONITOR_DISTANCE), channelIndex: 2 },
      { label: 'LFE', position: [0, 0, 0], channelIndex: 3, isLFE: true },
      { label: 'SL', position: speakerFromPolar(110, 0, MONITOR_DISTANCE), channelIndex: 4 },
      { label: 'SR', position: speakerFromPolar(-110, 0, MONITOR_DISTANCE), channelIndex: 5 },
    ],
    channelCount: 6,
    lfeCrossoverHz: 120,
  }
}

// TODO: wire into ExportDialog when 7.1/Atmos export modes are added
export function createLayout71(): SpeakerLayout {
  return {
    name: '7.1',
    id: '7.1',
    speakers: [
      { label: 'FL', position: speakerFromPolar(30, 0, MONITOR_DISTANCE), channelIndex: 0 },
      { label: 'FR', position: speakerFromPolar(-30, 0, MONITOR_DISTANCE), channelIndex: 1 },
      { label: 'C', position: speakerFromPolar(0, 0, MONITOR_DISTANCE), channelIndex: 2 },
      { label: 'LFE', position: [0, 0, 0], channelIndex: 3, isLFE: true },
      { label: 'SL', position: speakerFromPolar(110, 0, MONITOR_DISTANCE), channelIndex: 4 },
      { label: 'SR', position: speakerFromPolar(-110, 0, MONITOR_DISTANCE), channelIndex: 5 },
      { label: 'RL', position: speakerFromPolar(150, 0, MONITOR_DISTANCE), channelIndex: 6 },
      { label: 'RR', position: speakerFromPolar(-150, 0, MONITOR_DISTANCE), channelIndex: 7 },
    ],
    channelCount: 8,
    lfeCrossoverHz: 120,
  }
}

// TODO: wire into ExportDialog when 7.1/Atmos export modes are added
export function createLayout714(): SpeakerLayout {
  return {
    name: '7.1.4 Atmos Bed',
    id: '7.1.4',
    speakers: [
      { label: 'FL', position: speakerFromPolar(30, 0, MONITOR_DISTANCE), channelIndex: 0 },
      { label: 'FR', position: speakerFromPolar(-30, 0, MONITOR_DISTANCE), channelIndex: 1 },
      { label: 'C', position: speakerFromPolar(0, 0, MONITOR_DISTANCE), channelIndex: 2 },
      { label: 'LFE', position: [0, 0, 0], channelIndex: 3, isLFE: true },
      { label: 'SL', position: speakerFromPolar(110, 0, MONITOR_DISTANCE), channelIndex: 4 },
      { label: 'SR', position: speakerFromPolar(-110, 0, MONITOR_DISTANCE), channelIndex: 5 },
      { label: 'RL', position: speakerFromPolar(150, 0, MONITOR_DISTANCE), channelIndex: 6 },
      { label: 'RR', position: speakerFromPolar(-150, 0, MONITOR_DISTANCE), channelIndex: 7 },
      { label: 'TFL', position: speakerFromPolar(45, 45, MONITOR_DISTANCE), channelIndex: 8 },
      { label: 'TFR', position: speakerFromPolar(-45, 45, MONITOR_DISTANCE), channelIndex: 9 },
      { label: 'TRL', position: speakerFromPolar(135, 45, MONITOR_DISTANCE), channelIndex: 10 },
      { label: 'TRR', position: speakerFromPolar(-135, 45, MONITOR_DISTANCE), channelIndex: 11 },
    ],
    channelCount: 12,
    lfeCrossoverHz: 120,
  }
}

/**
 * Computes VBAP gains for a source position against any speaker layout.
 * Returns a Float32Array of length layout.channelCount.
 *
 * 2D VBAP on the horizontal plane for non-LFE speakers.
 * LFE speakers receive a fixed 0.5 gain scaled by distance attenuation.
 */
export function computeVBAPGains(
  position: SourcePosition,
  layout: SpeakerLayout,
): Float32Array {
  const [x, , z] = position
  const sourceAngle = Math.atan2(x, -z)
  const dist = Math.sqrt(position[0] * position[0] + position[1] * position[1] + position[2] * position[2])
  const attenuation = 1 / Math.max(1, dist)

  const gains = new Float32Array(layout.channelCount)

  // Separate non-LFE speakers and sort by azimuth angle for pair finding
  const nonLFE = layout.speakers
    .filter((s) => !s.isLFE)
    .map((s) => {
      const angle = Math.atan2(s.position[0], -s.position[2])
      return { speaker: s, angle }
    })
    .sort((a, b) => a.angle - b.angle)

  // TODO: 3D VBAP for height speakers -- find enclosing speaker triplet on
  // convex hull and solve 3x3 gain matrix. For now, 2D VBAP on the horizontal
  // plane is used for all non-LFE speakers (height speakers get nearest-speaker
  // fallback from the 2D projection).

  const n = nonLFE.length
  if (n === 0) {
    // No non-LFE speakers, only fill LFE
    for (const s of layout.speakers) {
      if (s.isLFE) gains[s.channelIndex] = 0.5 * attenuation
    }
    return gains
  }

  // VBAP pair search
  let found = false
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    const a1 = nonLFE[i].angle
    const a2 = nonLFE[j].angle

    let lo = a1
    const hi = a2
    let angle = sourceAngle

    if (j === 0) {
      // Wrap-around pair (last to first through the rear)
      lo = a1 - 2 * Math.PI
      if (sourceAngle > a1) {
        angle = sourceAngle - 2 * Math.PI
      }
    }

    if ((lo <= angle && angle <= hi) || Math.abs(angle - lo) < 1e-6 || Math.abs(angle - hi) < 1e-6) {
      const ca1 = Math.cos(a1), sa1 = Math.sin(a1)
      const ca2 = Math.cos(a2), sa2 = Math.sin(a2)
      const cs = Math.cos(angle), ss = Math.sin(angle)

      const det = ca1 * sa2 - ca2 * sa1
      if (Math.abs(det) < 1e-9) {
        // Degenerate -- assign fully to nearest
        const d1 = Math.abs(sourceAngle - a1)
        const d2 = Math.abs(sourceAngle - a2)
        gains[nonLFE[d1 <= d2 ? i : j].speaker.channelIndex] = attenuation
      } else {
        const g1 = Math.max(0, (sa2 * cs - ca2 * ss) / det)
        const g2 = Math.max(0, (-sa1 * cs + ca1 * ss) / det)
        const sum = g1 + g2
        if (sum > 0) {
          gains[nonLFE[i].speaker.channelIndex] = (g1 / sum) * attenuation
          gains[nonLFE[j].speaker.channelIndex] = (g2 / sum) * attenuation
        }
      }
      found = true
      break
    }
  }

  // Fallback: nearest speaker
  if (!found) {
    let bestIdx = 0
    let bestDist = Infinity
    for (let i = 0; i < n; i++) {
      const d = Math.abs(sourceAngle - nonLFE[i].angle)
      if (d < bestDist) { bestDist = d; bestIdx = i }
    }
    gains[nonLFE[bestIdx].speaker.channelIndex] = attenuation
  }

  // LFE: fixed 0.5 scaled by distance attenuation
  for (const s of layout.speakers) {
    if (s.isLFE) gains[s.channelIndex] = 0.5 * attenuation
  }

  return gains
}
