import { StateCreator } from 'zustand'
import { AppState, HistoryState } from '../../types'
import { usePluginStore } from '../../plugins/usePluginStore'
import { rebuildAllEffectChains } from '../../plugins/effectChain'

export interface HistorySlice {
  undoStack: HistoryState[]
  redoStack: HistoryState[]
  recordHistory: (label?: string) => void
  undo: () => void
  redo: () => void
}

export const createHistorySlice: StateCreator<AppState, [], [], HistorySlice> = (set, get) => ({
  undoStack: [],
  redoStack: [],

  recordHistory: (label = 'Action') => {
    const { sources, animations, undoStack, roomSize } = get()
    
    const pluginStore = usePluginStore.getState()
    const pluginState = Array.from(pluginStore.activePlugins.values()).map(instance => ({
      pluginId: instance.manifest.id,
      parameters: { ...instance.parameters },
      target: instance.target,
      slot: instance.slot,
      enabled: instance.enabled,
    }))

    const snapshot: HistoryState = JSON.parse(JSON.stringify({
      label,
      sources,
      animations,
      pluginState,
      roomSize // Added this
    }))

    set({ 
      undoStack: [...undoStack.slice(-49), snapshot],
      redoStack: [] 
    })
  },

  undo: () => {
    const { undoStack, redoStack, sources, animations, roomSize } = get()
    if (undoStack.length === 0) return

    const pluginStore = usePluginStore.getState()
    const currentPluginState = Array.from(pluginStore.activePlugins.values()).map(instance => ({
      pluginId: instance.manifest.id,
      parameters: { ...instance.parameters },
      target: instance.target,
      slot: instance.slot,
      enabled: instance.enabled,
    }))

    const currentSnapshot: HistoryState = JSON.parse(JSON.stringify({
      label: 'Undo',
      sources,
      animations,
      pluginState: currentPluginState,
      roomSize
    }))

    const prevState = undoStack[undoStack.length - 1]
    const nextUndoStack = undoStack.slice(0, -1)

    set({
      sources: prevState.sources,
      animations: prevState.animations,
      roomSize: (prevState as any).roomSize ?? [20, 20],
      undoStack: nextUndoStack,
      redoStack: [...redoStack, currentSnapshot],
      isDirty: true
    })

    prevState.pluginState.forEach(ps => {
      const instance = pluginStore.activePlugins.get(ps.pluginId)
      if (instance) {
        instance.enabled = ps.enabled
        instance.target = ps.target
        instance.slot = ps.slot
        Object.entries(ps.parameters).forEach(([pid, val]) => {
          instance.parameters[pid] = val
          instance.plugin.setParameter(pid, val as any)
        })
      }
    })
    rebuildAllEffectChains()
  },

  redo: () => {
    const { undoStack, redoStack, sources, animations, roomSize } = get()
    if (redoStack.length === 0) return

    const pluginStore = usePluginStore.getState()
    const currentPluginState = Array.from(pluginStore.activePlugins.values()).map(instance => ({
      pluginId: instance.manifest.id,
      parameters: { ...instance.parameters },
      target: instance.target,
      slot: instance.slot,
      enabled: instance.enabled,
    }))

    const currentSnapshot: HistoryState = JSON.parse(JSON.stringify({
      label: 'Redo',
      sources,
      animations,
      pluginState: currentPluginState,
      roomSize
    }))

    const nextState = redoStack[redoStack.length - 1]
    const nextRedoStack = redoStack.slice(0, -1)

    set({
      sources: nextState.sources,
      animations: nextState.animations,
      roomSize: (nextState as any).roomSize ?? [20, 20],
      undoStack: [...undoStack, currentSnapshot],
      redoStack: nextRedoStack,
      isDirty: true
    })

    nextState.pluginState.forEach(ps => {
      const instance = pluginStore.activePlugins.get(ps.pluginId)
      if (instance) {
        instance.enabled = ps.enabled
        instance.target = ps.target
        instance.slot = ps.slot
        Object.entries(ps.parameters).forEach(([pid, val]) => {
          instance.parameters[pid] = val
          instance.plugin.setParameter(pid, val as any)
        })
      }
    })
    rebuildAllEffectChains()
  },
})
