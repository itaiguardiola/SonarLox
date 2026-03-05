import type { SourceId, SourcePosition, SourceAnimation, EasingType } from '../types'

function easeLinear(t: number): number {
  return t
}

function easeIn(t: number): number {
  return t * t * t
}

function easeOut(t: number): number {
  const inv = 1 - t
  return 1 - inv * inv * inv
}

function easeInOut(t: number): number {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2
}

const EASING_FNS: Record<EasingType, (t: number) => number> = {
  'linear': easeLinear,
  'ease-in': easeIn,
  'ease-out': easeOut,
  'ease-in-out': easeInOut,
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function lerpPosition(a: SourcePosition, b: SourcePosition, t: number): SourcePosition {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]
}

/**
 * Catmull-Rom spline interpolation for smooth 3D paths.
 * Uses four control points: p0, p1, p2, p3. Interpolates between p1 and p2.
 */
function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const v0 = (p2 - p0) * 0.5
  const v1 = (p3 - p1) * 0.5
  const t2 = t * t
  const t3 = t * t2
  return (2 * p1 - 2 * p2 + v0 + v1) * t3 + (-3 * p1 + 3 * p2 - 2 * v0 - v1) * t2 + v0 * t + p1
}

function catmullRomPosition(p0: SourcePosition, p1: SourcePosition, p2: SourcePosition, p3: SourcePosition, t: number): SourcePosition {
  return [
    catmullRom(p0[0], p1[0], p2[0], p3[0], t),
    catmullRom(p0[1], p1[1], p2[1], p3[1], t),
    catmullRom(p0[2], p1[2], p2[2], p3[2], t)
  ]
}

export function getAnimatedPosition(
  sourceId: SourceId,
  time: number,
  animations: Record<SourceId, SourceAnimation>,
  fallback: SourcePosition,
): SourcePosition {
  const anim = animations[sourceId]
  if (!anim || anim.keyframes.length === 0) return fallback

  const kfs = anim.keyframes
  if (time <= kfs[0].time) return kfs[0].position
  if (time >= kfs[kfs.length - 1].time) return kfs[kfs.length - 1].position

  // Binary search for bracket
  let lo = 0
  let hi = kfs.length - 1
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1
    if (kfs[mid].time <= time) lo = mid
    else hi = mid
  }

  const kf0 = kfs[lo]
  const kf1 = kfs[hi]
  const span = kf1.time - kf0.time
  if (span <= 0) return kf0.position

  const rawT = (time - kf0.time) / span
  const easedT = (EASING_FNS[kf0.easing] ?? easeLinear)(rawT)

  // For linear, just use lerp
  if (kf0.easing === 'linear') {
    return lerpPosition(kf0.position, kf1.position, easedT)
  }

  // For others, use spline if we have enough context
  const p0 = kfs[Math.max(0, lo - 1)].position
  const p1 = kf0.position
  const p2 = kf1.position
  const p3 = kfs[Math.min(kfs.length - 1, hi + 1)].position

  return catmullRomPosition(p0, p1, p2, p3, easedT)
}

export interface AnimatedPositionSample {
  time: number
  position: SourcePosition
}

export function getAnimatedPositionsAtIntervals(
  sourceId: SourceId,
  animations: Record<SourceId, SourceAnimation>,
  fallback: SourcePosition,
  duration: number,
  intervalMs: number,
): AnimatedPositionSample[] {
  const intervalSec = intervalMs / 1000
  const samples: AnimatedPositionSample[] = []
  for (let t = 0; t <= duration; t += intervalSec) {
    samples.push({
      time: t,
      position: getAnimatedPosition(sourceId, t, animations, fallback),
    })
  }
  return samples
}
