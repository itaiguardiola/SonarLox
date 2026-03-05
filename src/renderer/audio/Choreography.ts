import type { SourceId, SourcePosition, EasingType, Keyframe } from '../types'

// --- Room Bounds ---

export interface RoomBounds {
  x: number
  y: number
  z: number
}

// --- Context ---

export interface ChoreographyContext {
  sourceId: SourceId
  startPosition: SourcePosition
  startTime: number
  bpm: number
  duration: number
  roomBounds: RoomBounds
}

// --- Generated Output ---

export interface GeneratedKeyframes {
  primary: {
    sourceId: SourceId
    keyframes: Keyframe[]
  }
  secondary?: {
    sourceId: SourceId
    keyframes: Keyframe[]
  }
}

// --- Behaviour Parameter Interfaces ---

interface ClosingWallsParams {
  type: 'closing_walls'
  durationBeats?: number
  startRadius?: number
  endRadius?: number
  startAngle?: number
  endAngle?: number
  keyframesPerBeat?: number
}

interface PendulumDecayParams {
  type: 'pendulum_decay'
  durationBeats?: number
  swingAngle?: number
  startDistance?: number
  endDistance?: number
  decayFactor?: number
  keyframesPerBeat?: number
}

interface StalkingShadowParams {
  type: 'stalking_shadow'
  durationBeats?: number
  radius?: number
  startAngle?: number
  sweepRange?: number
  verticalAmplitude?: number
  spiralTightening?: number
  keyframesPerBeat?: number
}

interface WhisperApproachParams {
  type: 'whisper_approach'
  durationBeats?: number
  startDistance?: number
  endDistance?: number
  approachAngle?: number
  verticalDrift?: number
  keyframesPerBeat?: number
}

interface BreathingRadiusParams {
  type: 'breathing_radius'
  durationBeats?: number
  centreDistance?: number
  amplitude?: number
  breathsPerMinute?: number
  azimuth?: number
  keyframesPerBeat?: number
}

interface ArrivalSettleParams {
  type: 'arrival_settle'
  durationBeats?: number
  targetPosition?: SourcePosition
  initialRadius?: number
  spiralRevolutions?: number
  keyframesPerBeat?: number
}

interface HorizonDriftParams {
  type: 'horizon_drift'
  durationBeats?: number
  distance?: number
  startAngle?: number
  endAngle?: number
  height?: number
  keyframesPerBeat?: number
}

interface FloatDescentParams {
  type: 'float_descent'
  durationBeats?: number
  startHeight?: number
  endHeight?: number
  lateralSway?: number
  swayFrequency?: number
  distance?: number
  azimuth?: number
  keyframesPerBeat?: number
}

interface PhantomSplitParams {
  type: 'phantom_split'
  durationBeats?: number
  positionA?: SourcePosition
  positionB?: SourcePosition
  alternationRate?: number
  keyframesPerBeat?: number
  blend?: number
}

interface VertigoHelixParams {
  type: 'vertigo_helix'
  durationBeats?: number
  radius?: number
  revolutions?: number
  startHeight?: number
  endHeight?: number
  tiltDegrees?: number
  keyframesPerBeat?: number
}

interface CallResponseParams {
  type: 'call_response'
  durationBeats?: number
  turnBeats?: number
  approachDistance?: number
  retreatDistance?: number
  secondarySourceId: SourceId
  secondaryStartPosition: SourcePosition
  keyframesPerBeat?: number
}

interface OrbitCounterpointParams {
  type: 'orbit_counterpoint'
  durationBeats?: number
  radius?: number
  phaseOffset?: number
  revolutions?: number
  height?: number
  secondarySourceId: SourceId
  keyframesPerBeat?: number
}

interface MirrorDanceParams {
  type: 'mirror_dance'
  durationBeats?: number
  pathType?: 'arc' | 'figure8'
  radius?: number
  height?: number
  secondarySourceId: SourceId
  keyframesPerBeat?: number
}

export type ChoreographyBehaviour =
  | ClosingWallsParams
  | PendulumDecayParams
  | StalkingShadowParams
  | WhisperApproachParams
  | BreathingRadiusParams
  | ArrivalSettleParams
  | HorizonDriftParams
  | FloatDescentParams
  | PhantomSplitParams
  | VertigoHelixParams
  | CallResponseParams
  | OrbitCounterpointParams
  | MirrorDanceParams

// --- Helpers ---

const DEG2RAD = Math.PI / 180

function beatsToSeconds(beats: number, bpm: number): number {
  const safeBpm = (Number.isFinite(bpm) && bpm > 0) ? bpm : 120
  return (60 / safeBpm) * beats
}

function polarToCartesian(angleDeg: number, distance: number, y: number): SourcePosition {
  const rad = angleDeg * DEG2RAD
  return [
    Math.sin(rad) * distance,
    y,
    -Math.cos(rad) * distance,
  ]
}

function clampPosition(pos: SourcePosition, bounds: RoomBounds): SourcePosition {
  return [
    Math.max(-bounds.x, Math.min(bounds.x, pos[0])),
    Math.max(0, Math.min(bounds.y, pos[1])),
    Math.max(-bounds.z, Math.min(bounds.z, pos[2])),
  ]
}

function azimuthFromPosition(pos: SourcePosition): number {
  return Math.atan2(pos[0], -pos[2]) / DEG2RAD
}

function makeKeyframe(time: number, pos: SourcePosition, easing: EasingType, bounds: RoomBounds): Keyframe {
  return { time, position: clampPosition(pos, bounds), easing }
}

// --- Primitive Implementations ---

function closingWalls(params: ClosingWallsParams, ctx: ChoreographyContext): GeneratedKeyframes {
  const durationBeats = params.durationBeats ?? 8
  const startRadius = params.startRadius ?? 8
  const endRadius = params.endRadius ?? 1.5
  const startAngle = params.startAngle ?? 90
  const endAngle = params.endAngle ?? 10
  const kpb = params.keyframesPerBeat ?? 2

  const totalSec = beatsToSeconds(durationBeats, ctx.bpm)
  const totalKf = Math.max(2, Math.round(durationBeats * kpb))
  const keyframes: Keyframe[] = []
  const y = ctx.startPosition[1]

  for (let i = 0; i <= totalKf; i++) {
    const t = i / totalKf
    // ease-in: compress accelerates
    const eased = t * t
    const radius = startRadius + (endRadius - startRadius) * eased
    const angle = startAngle + (endAngle - startAngle) * eased
    const time = ctx.startTime + t * totalSec
    keyframes.push(makeKeyframe(time, polarToCartesian(angle, radius, y), 'ease-in', ctx.roomBounds))
  }

  return { primary: { sourceId: ctx.sourceId, keyframes } }
}

function pendulumDecay(params: PendulumDecayParams, ctx: ChoreographyContext): GeneratedKeyframes {
  const durationBeats = params.durationBeats ?? 16
  const swingAngle = params.swingAngle ?? 120
  const startDistance = params.startDistance ?? 8
  const endDistance = params.endDistance ?? 2
  const decayFactor = params.decayFactor ?? 0.85
  const kpb = params.keyframesPerBeat ?? 2

  const totalSec = beatsToSeconds(durationBeats, ctx.bpm)
  const totalKf = Math.max(2, Math.round(durationBeats * kpb))
  const keyframes: Keyframe[] = []
  const y = ctx.startPosition[1]
  const baseAzimuth = azimuthFromPosition(ctx.startPosition)

  for (let i = 0; i <= totalKf; i++) {
    const t = i / totalKf
    const time = ctx.startTime + t * totalSec

    // Number of half-cycles completed at this point
    const halfCycles = t * durationBeats
    const currentHalf = Math.floor(halfCycles)
    const withinHalf = halfCycles - currentHalf

    // Amplitude decays with each half-cycle
    const amp = (swingAngle / 2) * Math.pow(decayFactor, currentHalf)
    // Sinusoidal within each half-cycle
    const direction = currentHalf % 2 === 0 ? 1 : -1
    const angle = baseAzimuth + direction * amp * Math.sin(withinHalf * Math.PI)

    const distance = startDistance + (endDistance - startDistance) * t
    keyframes.push(makeKeyframe(time, polarToCartesian(angle, distance, y), 'linear', ctx.roomBounds))
  }

  return { primary: { sourceId: ctx.sourceId, keyframes } }
}

function stalkingShadow(params: StalkingShadowParams, ctx: ChoreographyContext): GeneratedKeyframes {
  const durationBeats = params.durationBeats ?? 16
  const radius = params.radius ?? 4
  const sweepCenter = params.startAngle ?? 180
  const sweepRange = params.sweepRange ?? 120
  const verticalAmplitude = params.verticalAmplitude ?? 2
  const spiralTightening = params.spiralTightening ?? 0.7
  const kpb = params.keyframesPerBeat ?? 2

  const totalSec = beatsToSeconds(durationBeats, ctx.bpm)
  const totalKf = Math.max(2, Math.round(durationBeats * kpb))
  const keyframes: Keyframe[] = []
  const baseY = ctx.startPosition[1]

  for (let i = 0; i <= totalKf; i++) {
    const t = i / totalKf
    const time = ctx.startTime + t * totalSec

    // Azimuth sweeps back and forth centred on startAngle
    const azimuth = sweepCenter + (sweepRange / 2) * Math.sin(t * 2 * Math.PI)
    // Height oscillates at 1.5x azimuth frequency
    const y = baseY + verticalAmplitude * 0.5 * (1 + Math.sin(t * 3 * Math.PI))
    // Radius tightens
    const r = radius * (1 - t * (1 - spiralTightening))

    keyframes.push(makeKeyframe(time, polarToCartesian(azimuth, r, y), 'linear', ctx.roomBounds))
  }

  return { primary: { sourceId: ctx.sourceId, keyframes } }
}

function whisperApproach(params: WhisperApproachParams, ctx: ChoreographyContext): GeneratedKeyframes {
  const durationBeats = params.durationBeats ?? 8
  const startDistance = params.startDistance ?? 2.5
  const endDistance = Math.max(0.2, params.endDistance ?? 0.3)
  const approachAngle = params.approachAngle ?? -30
  const verticalDrift = params.verticalDrift ?? 0.1
  const kpb = params.keyframesPerBeat ?? 2

  const totalSec = beatsToSeconds(durationBeats, ctx.bpm)
  const totalKf = Math.max(2, Math.round(durationBeats * kpb))
  const keyframes: Keyframe[] = []
  const baseY = ctx.startPosition[1]

  for (let i = 0; i <= totalKf; i++) {
    const t = i / totalKf
    const time = ctx.startTime + t * totalSec

    // Logarithmic approach: fast at first, slows near end
    const logT = 1 - Math.pow(1 - t, 2)
    const distance = startDistance + (endDistance - startDistance) * logT
    const y = baseY + verticalDrift * Math.sin(t * 4 * Math.PI)

    keyframes.push(makeKeyframe(time, polarToCartesian(approachAngle, distance, y), 'ease-out', ctx.roomBounds))
  }

  return { primary: { sourceId: ctx.sourceId, keyframes } }
}

function breathingRadius(params: BreathingRadiusParams, ctx: ChoreographyContext): GeneratedKeyframes {
  const durationBeats = params.durationBeats ?? 16
  const centreDistance = params.centreDistance ?? 1.5
  const amplitude = params.amplitude ?? 0.5
  const breathsPerMinute = params.breathsPerMinute ?? 15
  const azimuth = params.azimuth ?? 0
  const kpb = params.keyframesPerBeat ?? 2

  const totalSec = beatsToSeconds(durationBeats, ctx.bpm)
  const totalKf = Math.max(2, Math.round(durationBeats * kpb))
  const keyframes: Keyframe[] = []
  const baseY = ctx.startPosition[1]

  const breathFreqHz = breathsPerMinute / 60

  for (let i = 0; i <= totalKf; i++) {
    const t = i / totalKf
    const timeSec = t * totalSec
    const time = ctx.startTime + timeSec

    const distance = centreDistance + amplitude * Math.sin(2 * Math.PI * breathFreqHz * timeSec)
    const y = baseY + 0.03 * Math.sin(2 * Math.PI * breathFreqHz * 2 * timeSec)

    keyframes.push(makeKeyframe(time, polarToCartesian(azimuth, Math.max(0.2, distance), y), 'linear', ctx.roomBounds))
  }

  return { primary: { sourceId: ctx.sourceId, keyframes } }
}

function arrivalSettle(params: ArrivalSettleParams, ctx: ChoreographyContext): GeneratedKeyframes {
  const durationBeats = params.durationBeats ?? 8
  const targetPosition = params.targetPosition ?? [0, 1, -3] as SourcePosition
  const initialRadius = params.initialRadius ?? 6
  const spiralRevolutions = params.spiralRevolutions ?? 2.5
  const kpb = params.keyframesPerBeat ?? 2

  const totalSec = beatsToSeconds(durationBeats, ctx.bpm)
  const totalKf = Math.max(2, Math.round(durationBeats * kpb))
  const keyframes: Keyframe[] = []

  for (let i = 0; i <= totalKf; i++) {
    const t = i / totalKf
    const time = ctx.startTime + t * totalSec

    // Quadratic radius falloff for visible deceleration
    const r = initialRadius * Math.pow(1 - t, 2)
    const angle = t * spiralRevolutions * 360
    const y = ctx.startPosition[1] + (targetPosition[1] - ctx.startPosition[1]) * t

    const x = targetPosition[0] + Math.sin(angle * DEG2RAD) * r
    const z = targetPosition[2] - Math.cos(angle * DEG2RAD) * r

    keyframes.push(makeKeyframe(time, [x, y, z], 'ease-out', ctx.roomBounds))
  }

  // Ensure final keyframe is exactly at target
  keyframes[keyframes.length - 1] = makeKeyframe(
    ctx.startTime + totalSec,
    targetPosition,
    'ease-out',
    ctx.roomBounds,
  )

  return { primary: { sourceId: ctx.sourceId, keyframes } }
}

function horizonDrift(params: HorizonDriftParams, ctx: ChoreographyContext): GeneratedKeyframes {
  const durationBeats = params.durationBeats ?? 16
  const distance = params.distance ?? 6
  const startAngle = params.startAngle ?? -60
  const endAngle = params.endAngle ?? 60
  const height = params.height ?? 1
  const kpb = params.keyframesPerBeat ?? 1

  const totalSec = beatsToSeconds(durationBeats, ctx.bpm)
  const totalKf = Math.max(2, Math.round(durationBeats * kpb))
  const keyframes: Keyframe[] = []

  for (let i = 0; i <= totalKf; i++) {
    const t = i / totalKf
    const time = ctx.startTime + t * totalSec
    const angle = startAngle + (endAngle - startAngle) * t

    keyframes.push(makeKeyframe(time, polarToCartesian(angle, distance, height), 'ease-in-out', ctx.roomBounds))
  }

  return { primary: { sourceId: ctx.sourceId, keyframes } }
}

function floatDescent(params: FloatDescentParams, ctx: ChoreographyContext): GeneratedKeyframes {
  const durationBeats = params.durationBeats ?? 12
  const startHeight = params.startHeight ?? 5
  const endHeight = params.endHeight ?? 1
  const lateralSway = params.lateralSway ?? 1.5
  const swayFrequency = params.swayFrequency ?? 2
  const distance = params.distance ?? 4
  const azimuth = params.azimuth ?? 0
  const kpb = params.keyframesPerBeat ?? 2

  const totalSec = beatsToSeconds(durationBeats, ctx.bpm)
  const totalKf = Math.max(2, Math.round(durationBeats * kpb))
  const keyframes: Keyframe[] = []

  const basePos = polarToCartesian(azimuth, distance, 0)

  for (let i = 0; i <= totalKf; i++) {
    const t = i / totalKf
    const time = ctx.startTime + t * totalSec

    // ease-out height descent: fast initial drop, gentle settling
    const heightT = 1 - Math.pow(1 - t, 2)
    const y = startHeight + (endHeight - startHeight) * heightT

    // Lateral sway with linearly decreasing amplitude
    const swayAmp = lateralSway * (1 - t)
    const swayOffset = swayAmp * Math.sin(t * swayFrequency * 2 * Math.PI)

    const x = basePos[0] + swayOffset
    const z = basePos[2]

    keyframes.push(makeKeyframe(time, [x, y, z], 'ease-out', ctx.roomBounds))
  }

  return { primary: { sourceId: ctx.sourceId, keyframes } }
}

function phantomSplit(params: PhantomSplitParams, ctx: ChoreographyContext): GeneratedKeyframes {
  const durationBeats = params.durationBeats ?? 4
  const positionA = params.positionA ?? [-3, 1, -2] as SourcePosition
  const positionB = params.positionB ?? [3, 1, -2] as SourcePosition
  const alternationRate = params.alternationRate ?? params.keyframesPerBeat ?? 8
  const blend = Math.max(0, Math.min(1, params.blend ?? 0))

  const totalSec = beatsToSeconds(durationBeats, ctx.bpm)
  const totalAlternations = Math.min(durationBeats * alternationRate, 256)
  const keyframes: Keyframe[] = []

  for (let i = 0; i <= totalAlternations; i++) {
    const t = i / totalAlternations
    const time = ctx.startTime + t * totalSec
    const easing: EasingType = blend > 0 ? 'ease-in-out' : 'linear'

    if (blend <= 0) {
      // Hard switch
      const pos = i % 2 === 0 ? positionA : positionB
      keyframes.push(makeKeyframe(time, pos, easing, ctx.roomBounds))
    } else {
      // Blended: sinusoidal crossfade between A and B
      const phase = i * Math.PI
      const crossfade = 0.5 - 0.5 * Math.cos(phase)
      // blend controls how much interpolation vs hard-switch: 0 = hard, 1 = full sine
      const mixT = blend * crossfade + (1 - blend) * (i % 2)
      const pos: SourcePosition = [
        positionA[0] + (positionB[0] - positionA[0]) * mixT,
        positionA[1] + (positionB[1] - positionA[1]) * mixT,
        positionA[2] + (positionB[2] - positionA[2]) * mixT,
      ]
      keyframes.push(makeKeyframe(time, pos, easing, ctx.roomBounds))
    }
  }

  return { primary: { sourceId: ctx.sourceId, keyframes } }
}

function vertigoHelix(params: VertigoHelixParams, ctx: ChoreographyContext): GeneratedKeyframes {
  const durationBeats = params.durationBeats ?? 8
  const radius = params.radius ?? 3
  const revolutions = params.revolutions ?? 3
  const startHeight = params.startHeight ?? 0
  const endHeight = params.endHeight ?? 6
  const tiltDeg = params.tiltDegrees ?? 30
  const kpb = params.keyframesPerBeat ?? 4

  const totalSec = beatsToSeconds(durationBeats, ctx.bpm)
  const totalKf = Math.max(2, Math.round(durationBeats * kpb))
  const keyframes: Keyframe[] = []
  const tiltRad = tiltDeg * DEG2RAD

  for (let i = 0; i <= totalKf; i++) {
    const t = i / totalKf
    const time = ctx.startTime + t * totalSec
    const angle = t * revolutions * 2 * Math.PI

    // Raised cosine height profile
    const heightFraction = 0.5 * (1 - Math.cos(t * Math.PI))
    const h = startHeight + (endHeight - startHeight) * heightFraction

    // Cylindrical coordinates before tilt
    const cx = radius * Math.cos(angle)
    const cy = h
    const cz = radius * Math.sin(angle)

    // Tilt around X axis toward -Z
    const cosT = Math.cos(tiltRad)
    const sinT = Math.sin(tiltRad)
    const newY = cy * cosT - cz * sinT
    const newZ = cy * sinT + cz * cosT

    keyframes.push(makeKeyframe(time, [cx, newY, newZ], 'linear', ctx.roomBounds))
  }

  return { primary: { sourceId: ctx.sourceId, keyframes } }
}

function callResponse(params: CallResponseParams, ctx: ChoreographyContext): GeneratedKeyframes {
  const durationBeats = params.durationBeats ?? 16
  const turnBeats = params.turnBeats ?? 4
  const approachDist = params.approachDistance ?? 1.5
  const retreatDist = params.retreatDistance ?? 4
  const kpb = params.keyframesPerBeat ?? 2

  const totalSec = beatsToSeconds(durationBeats, ctx.bpm)
  const totalKf = Math.max(2, Math.round(durationBeats * kpb))
  const turnSec = beatsToSeconds(turnBeats, ctx.bpm)

  const primaryAzimuth = azimuthFromPosition(ctx.startPosition)
  const secondaryAzimuth = azimuthFromPosition(params.secondaryStartPosition)
  const primaryY = ctx.startPosition[1]
  const secondaryY = params.secondaryStartPosition[1]

  const primaryKf: Keyframe[] = []
  const secondaryKf: Keyframe[] = []

  for (let i = 0; i <= totalKf; i++) {
    const t = i / totalKf
    const timeSec = t * totalSec
    const time = ctx.startTime + timeSec

    const turnIndex = Math.floor(timeSec / turnSec)
    const withinTurn = (timeSec % turnSec) / turnSec
    // Ease-in-out within each turn
    const eased = withinTurn < 0.5
      ? 2 * withinTurn * withinTurn
      : 1 - Math.pow(-2 * withinTurn + 2, 2) / 2

    const primaryApproaching = turnIndex % 2 === 0

    const pDist = primaryApproaching
      ? retreatDist + (approachDist - retreatDist) * eased
      : approachDist + (retreatDist - approachDist) * eased
    const sDist = primaryApproaching
      ? approachDist + (retreatDist - approachDist) * eased
      : retreatDist + (approachDist - retreatDist) * eased

    primaryKf.push(makeKeyframe(time, polarToCartesian(primaryAzimuth, pDist, primaryY), 'ease-in-out', ctx.roomBounds))
    secondaryKf.push(makeKeyframe(time, polarToCartesian(secondaryAzimuth, sDist, secondaryY), 'ease-in-out', ctx.roomBounds))
  }

  return {
    primary: { sourceId: ctx.sourceId, keyframes: primaryKf },
    secondary: { sourceId: params.secondarySourceId, keyframes: secondaryKf },
  }
}

function orbitCounterpoint(params: OrbitCounterpointParams, ctx: ChoreographyContext): GeneratedKeyframes {
  const durationBeats = params.durationBeats ?? 16
  const radius = params.radius ?? 4
  const phaseOffset = params.phaseOffset ?? 180
  const revolutions = params.revolutions ?? 2
  const height = params.height ?? 1
  const kpb = params.keyframesPerBeat ?? 2

  const totalSec = beatsToSeconds(durationBeats, ctx.bpm)
  const totalKf = Math.max(2, Math.round(durationBeats * kpb))

  const primaryStartAzimuth = azimuthFromPosition(ctx.startPosition)
  const secondaryStartAzimuth = primaryStartAzimuth + phaseOffset

  const primaryKf: Keyframe[] = []
  const secondaryKf: Keyframe[] = []

  for (let i = 0; i <= totalKf; i++) {
    const t = i / totalKf
    const time = ctx.startTime + t * totalSec
    const sweep = t * revolutions * 360

    const pAngle = primaryStartAzimuth + sweep
    const sAngle = secondaryStartAzimuth - sweep

    primaryKf.push(makeKeyframe(time, polarToCartesian(pAngle, radius, height), 'linear', ctx.roomBounds))
    secondaryKf.push(makeKeyframe(time, polarToCartesian(sAngle, radius, height), 'linear', ctx.roomBounds))
  }

  return {
    primary: { sourceId: ctx.sourceId, keyframes: primaryKf },
    secondary: { sourceId: params.secondarySourceId, keyframes: secondaryKf },
  }
}

function mirrorDance(params: MirrorDanceParams, ctx: ChoreographyContext): GeneratedKeyframes {
  const durationBeats = params.durationBeats ?? 8
  const pathType = params.pathType ?? 'arc'
  const radius = params.radius ?? 4
  const height = params.height ?? 1
  const kpb = params.keyframesPerBeat ?? 2

  const totalSec = beatsToSeconds(durationBeats, ctx.bpm)
  const totalKf = Math.max(2, Math.round(durationBeats * kpb))

  const primaryKf: Keyframe[] = []
  const secondaryKf: Keyframe[] = []

  for (let i = 0; i <= totalKf; i++) {
    const t = i / totalKf
    const time = ctx.startTime + t * totalSec

    let x: number, z: number

    if (pathType === 'figure8') {
      // Lemniscate of Bernoulli in XZ plane
      const angle = t * 2 * Math.PI
      const denom = 1 + Math.sin(angle) * Math.sin(angle)
      x = (radius * Math.cos(angle)) / denom
      z = (radius * Math.sin(angle) * Math.cos(angle)) / denom - 3
    } else {
      // Arc: semicircular sweep
      const angle = -90 + 180 * t
      x = radius * Math.sin(angle * DEG2RAD)
      z = -radius * Math.cos(angle * DEG2RAD)
    }

    primaryKf.push(makeKeyframe(time, [x, height, z], 'ease-in-out', ctx.roomBounds))
    // Mirror across median plane: negate X
    secondaryKf.push(makeKeyframe(time, [-x, height, z], 'ease-in-out', ctx.roomBounds))
  }

  return {
    primary: { sourceId: ctx.sourceId, keyframes: primaryKf },
    secondary: { sourceId: params.secondarySourceId, keyframes: secondaryKf },
  }
}

// --- Dispatcher ---

/**
 * Generate keyframe arrays from a named choreography behaviour.
 * Pure function -- no side effects, no store access.
 */
export function generateKeyframes(
  behaviour: ChoreographyBehaviour,
  context: ChoreographyContext,
): GeneratedKeyframes {
  switch (behaviour.type) {
    case 'closing_walls': return closingWalls(behaviour, context)
    case 'pendulum_decay': return pendulumDecay(behaviour, context)
    case 'stalking_shadow': return stalkingShadow(behaviour, context)
    case 'whisper_approach': return whisperApproach(behaviour, context)
    case 'breathing_radius': return breathingRadius(behaviour, context)
    case 'arrival_settle': return arrivalSettle(behaviour, context)
    case 'horizon_drift': return horizonDrift(behaviour, context)
    case 'float_descent': return floatDescent(behaviour, context)
    case 'phantom_split': return phantomSplit(behaviour, context)
    case 'vertigo_helix': return vertigoHelix(behaviour, context)
    case 'call_response': return callResponse(behaviour, context)
    case 'orbit_counterpoint': return orbitCounterpoint(behaviour, context)
    case 'mirror_dance': return mirrorDance(behaviour, context)
  }
}
