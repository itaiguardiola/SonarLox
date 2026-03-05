import { StateCreator } from 'zustand'
import { AppState, HistoryState, SourceId, SourceAnimation } from '../../types'
import { usePluginStore } from '../../plugins/usePluginStore'
import type { PluginParameterValue } from '../../plugins/types'
import { rebuildAllEffectChains } from '../../plugins/effectChain'

export interface HistorySlice {
  undoStack: HistoryState[]
  redoStack: HistoryState[]
  recordHistory: (label?: string) => void
  undo: () => void
  redo: () => void
}

function captureSnapshot(label: string, get: () => AppState): HistoryState {
  const { sources, animations, roomSize } = get()
  
  const pluginStore = usePluginStore.getState()
  const pluginState = Array.from(pluginStore.activePlugins.values()).map(instance => ({
    pluginId: instance.manifest.id,
    parameters: { ...instance.parameters },
    target: instance.target,
    slot: instance.slot,
    enabled: instance.enabled,
  }))

  const clonedSources = sources.map(s => ({ ...s, position: [...s.position] as [number, number, number] }))
  const clonedAnimations: Record<SourceId, SourceAnimation> = {}
  for (const [id, anim] of Object.entries(animations)) {
    clonedAnimations[id] = {
      sourceId: id,
      keyframes: anim.keyframes.map(kf => ({ ...kf, position: [...kf.position] }))
    }
  }

  return {
    label,
    sources: clonedSources,
    animations: clonedAnimations,
    pluginState,
    roomSize: [...roomSize] as [number, number]
  }
}

export const createHistorySlice: StateCreator<AppState, [], [], HistorySlice> = (set, get) => ({
  undoStack: [],
  redoStack: [],

  recordHistory: (label = 'Action') => {
    const { undoStack } = get()
    const snapshot = captureSnapshot(label, get)
    set({ 
      undoStack: [...undoStack.slice(-49), snapshot],
      redoStack: [] 
    })
  },

  undo: () => {
    const { undoStack, redoStack } = get()
    if (undoStack.length === 0) return

    const currentSnapshot = captureSnapshot('Undo', get)
    const prevState = undoStack[undoStack.length - 1]
    const nextUndoStack = undoStack.slice(0, -1)

    set({
      sources: prevState.sources,
      animations: prevState.animations,
      roomSize: prevState.roomSize ?? [20, 20],
      undoStack: nextUndoStack,
      redoStack: [...redoStack, currentSnapshot],
      isDirty: true
    })

    const pluginStore = usePluginStore.getState()
    prevState.pluginState.forEach(ps => {
      const instance = pluginStore.activePlugins.get(ps.pluginId)
      if (instance) {
        instance.enabled = ps.enabled
        instance.target = ps.target
        instance.slot = ps.slot
        Object.entries(ps.parameters).forEach(([pid, val]) => {
          instance.parameters[pid] = val
          instance.plugin.setParameter(pid, val as PluginParameterValue)
        })
      }
    })
    rebuildAllEffectChains()
  },

  redo: () => {
    const { undoStack, redoStack } = get()
    if (redoStack.length === 0) return

    const currentSnapshot = captureSnapshot('Redo', get)
    const nextState = redoStack[redoStack.length - 1]
    const nextRedoStack = redoStack.slice(0, -1)

    set({
      sources: nextState.sources,
      animations: nextState.animations,
      roomSize: nextState.roomSize ?? [20, 20],
      undoStack: [...undoStack, currentSnapshot],
      redoStack: nextRedoStack,
      isDirty: true
    })

    const pluginStore = usePluginStore.getState()
    nextState.pluginState.forEach(ps => {
      const instance = pluginStore.activePlugins.get(ps.pluginId)
      if (instance) {
        instance.enabled = ps.enabled
        instance.target = ps.target
        instance.slot = ps.slot
        Object.entries(ps.parameters).forEach(([pid, val]) => {
          instance.parameters[pid] = val
          instance.plugin.setParameter(pid, val as PluginParameterValue)
        })
      }
    })
    rebuildAllEffectChains()
  },
})
