import { describe, it, expect } from 'vitest'
import { getAnimatedPosition, getAnimatedPositionsAtIntervals } from '../audio/AnimationEngine'
import type { SourceAnimation, SourcePosition } from '../types'

const fallback: SourcePosition = [0, 0, 0]

function makeAnimation(keyframes: { time: number; position: SourcePosition; easing?: string }[]): Record<string, SourceAnimation> {
  return {
    'src-1': {
      sourceId: 'src-1',
      keyframes: keyframes.map((kf) => ({
        time: kf.time,
        position: kf.position,
        easing: (kf.easing ?? 'linear') as 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out',
      })),
    },
  }
}

describe('AnimationEngine', () => {
  describe('getAnimatedPosition', () => {
    it('returns fallback when no animation exists', () => {
      expect(getAnimatedPosition('src-1', 0, {}, fallback)).toEqual(fallback)
    })

    it('returns fallback when keyframes array is empty', () => {
      const anims = { 'src-1': { sourceId: 'src-1', keyframes: [] } }
      expect(getAnimatedPosition('src-1', 0, anims, fallback)).toEqual(fallback)
    })

    it('returns first keyframe position when time is before first keyframe', () => {
      const anims = makeAnimation([
        { time: 1, position: [1, 2, 3] },
        { time: 2, position: [4, 5, 6] },
      ])
      expect(getAnimatedPosition('src-1', 0, anims, fallback)).toEqual([1, 2, 3])
    })

    it('returns last keyframe position when time is after last keyframe', () => {
      const anims = makeAnimation([
        { time: 1, position: [1, 2, 3] },
        { time: 2, position: [4, 5, 6] },
      ])
      expect(getAnimatedPosition('src-1', 10, anims, fallback)).toEqual([4, 5, 6])
    })

    it('interpolates linearly at midpoint', () => {
      const anims = makeAnimation([
        { time: 0, position: [0, 0, 0], easing: 'linear' },
        { time: 2, position: [2, 4, 6], easing: 'linear' },
      ])
      const pos = getAnimatedPosition('src-1', 1, anims, fallback)
      expect(pos[0]).toBeCloseTo(1)
      expect(pos[1]).toBeCloseTo(2)
      expect(pos[2]).toBeCloseTo(3)
    })

    it('handles single keyframe', () => {
      const anims = makeAnimation([{ time: 1, position: [5, 5, 5] }])
      // Before = first keyframe
      expect(getAnimatedPosition('src-1', 0, anims, fallback)).toEqual([5, 5, 5])
      // After = last (same) keyframe
      expect(getAnimatedPosition('src-1', 2, anims, fallback)).toEqual([5, 5, 5])
    })

    it('uses ease-in easing (starts slow)', () => {
      const anims = makeAnimation([
        { time: 0, position: [0, 0, 0], easing: 'ease-in' },
        { time: 1, position: [10, 0, 0] },
      ])
      const pos = getAnimatedPosition('src-1', 0.25, anims, fallback)
      // ease-in (cubic) at t=0.25: 0.25^3 = 0.015625 -- position should be close to 0
      expect(pos[0]).toBeLessThan(2)
    })
  })

  describe('getAnimatedPositionsAtIntervals', () => {
    it('samples at the given interval', () => {
      const anims = makeAnimation([
        { time: 0, position: [0, 0, 0], easing: 'linear' },
        { time: 1, position: [10, 0, 0], easing: 'linear' },
      ])
      const samples = getAnimatedPositionsAtIntervals('src-1', 1, anims, fallback, 0.5)
      expect(samples.length).toBe(3) // t=0, 0.5, 1.0
      expect(samples[0].position[0]).toBeCloseTo(0)
      expect(samples[1].position[0]).toBeCloseTo(5)
      expect(samples[2].position[0]).toBeCloseTo(10)
    })
  })
})
