import { create } from 'zustand'
import { AppState } from '../types'
import { createSourceSlice } from './slices/SourceSlice'
import { createAnimationSlice } from './slices/AnimationSlice'
import { createHistorySlice } from './slices/HistorySlice'
import { createProjectSlice } from './slices/ProjectSlice'
import { createUiSlice } from './slices/UiSlice'

/**
 * Main application store for SonarLox, decomposed into logical slices.
 * Combines Source, Animation, History, Project, and UI state management.
 */
export const useAppStore = create<AppState>()((...a) => ({
  ...createSourceSlice(...a),
  ...createAnimationSlice(...a),
  ...createHistorySlice(...a),
  ...createProjectSlice(...a),
  ...createUiSlice(...a),
}))
