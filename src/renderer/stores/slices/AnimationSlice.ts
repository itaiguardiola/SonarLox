import { StateCreator } from 'zustand'
import { AppState, SourceId, SourcePosition, SourceAnimation, EasingType } from '../../types'

export interface AnimationSlice {
  animations: Record<SourceId, SourceAnimation>
  isRecordingKeyframes: boolean
  recordQuantize: number
  setKeyframe: (sourceId: SourceId, time: number, position: SourcePosition, easing?: EasingType) => void
  removeKeyframe: (sourceId: SourceId, time: number) => void
  clearAnimation: (sourceId: SourceId) => void
  setIsRecordingKeyframes: (v: boolean) => void
  setRecordQuantize: (q: number) => void
}

export const createAnimationSlice: StateCreator<AppState, [], [], AnimationSlice> = (set, get) => ({
  animations: {},
  isRecordingKeyframes: false,
  recordQuantize: 0.1,

  setKeyframe: (sourceId: SourceId, time: number, position, easing: EasingType = 'linear') => {
    const { animations, recordQuantize } = get()
    const quantizedTime = recordQuantize > 0
      ? Math.round(time / recordQuantize) * recordQuantize
      : time

    const existing = animations[sourceId] ?? { sourceId, keyframes: [] }
    const EPSILON = 0.001
    const filtered = existing.keyframes.filter((kf) => Math.abs(kf.time - quantizedTime) > EPSILON)
    const keyframes = [...filtered, { time: quantizedTime, position, easing }]
      .sort((a, b) => a.time - b.time)

    set({
      animations: { ...animations, [sourceId]: { sourceId, keyframes } },
      isDirty: true,
    })
  },

  removeKeyframe: (sourceId: SourceId, time: number) => {
    get().recordHistory('Remove keyframe')
    const { animations } = get()
    const anim = animations[sourceId]
    if (!anim) return
    const EPSILON = 0.001
    const keyframes = anim.keyframes.filter((kf) => Math.abs(kf.time - time) > EPSILON)
    if (keyframes.length === 0) {
      const next = { ...animations }
      delete next[sourceId]
      set({ animations: next, isDirty: true })
    } else {
      set({
        animations: { ...animations, [sourceId]: { ...anim, keyframes } },
        isDirty: true,
      })
    }
  },

  clearAnimation: (sourceId: SourceId) => {
    get().recordHistory('Clear animation')
    const { animations } = get()
    if (!animations[sourceId]) return
    const next = { ...animations }
    delete next[sourceId]
    set({ animations: next, isDirty: true })
  },

  setIsRecordingKeyframes: (isRecordingKeyframes) => set({ isRecordingKeyframes }),
  setRecordQuantize: (recordQuantize) => set({ recordQuantize }),
})
