import { create } from 'zustand'
import type { SourceId } from '../types'
import type { PluginManifest, PluginInstance, PluginParameterValue } from './types'

interface PluginStoreState {
  availablePlugins: PluginManifest[]
  activePlugins: Map<string, PluginInstance>
  isScanning: boolean

  setAvailablePlugins: (plugins: PluginManifest[]) => void
  setIsScanning: (v: boolean) => void

  activatePlugin: (instance: PluginInstance) => void
  deactivatePlugin: (pluginId: string) => void
  togglePlugin: (pluginId: string) => void

  setPluginParameter: (pluginId: string, paramId: string, value: PluginParameterValue) => void
  setPluginTarget: (pluginId: string, target: SourceId | 'master') => void
  setPluginSlot: (pluginId: string, slot: number) => void

  getEffectsForSource: (sourceId: SourceId) => PluginInstance[]
  getMasterEffects: () => PluginInstance[]
  getExporterPlugins: () => PluginInstance[]
}

export const usePluginStore = create<PluginStoreState>((set, get) => ({
  availablePlugins: [],
  activePlugins: new Map(),
  isScanning: false,

  setAvailablePlugins: (plugins) => set({ availablePlugins: plugins }),
  setIsScanning: (isScanning) => set({ isScanning }),

  activatePlugin: (instance) => {
    const next = new Map(get().activePlugins)
    next.set(instance.manifest.id, instance)
    set({ activePlugins: next })
  },

  deactivatePlugin: (pluginId) => {
    const next = new Map(get().activePlugins)
    const instance = next.get(pluginId)
    if (instance) {
      instance.plugin.deactivate()
      next.delete(pluginId)
      set({ activePlugins: next })
    }
  },

  togglePlugin: (pluginId) => {
    const next = new Map(get().activePlugins)
    const instance = next.get(pluginId)
    if (instance) {
      instance.enabled = !instance.enabled
      set({ activePlugins: next })
    }
  },

  setPluginParameter: (pluginId, paramId, value) => {
    const next = new Map(get().activePlugins)
    const instance = next.get(pluginId)
    if (instance) {
      instance.parameters[paramId] = value
      instance.plugin.setParameter(paramId, value)
      set({ activePlugins: next })
    }
  },

  setPluginTarget: (pluginId, target) => {
    const next = new Map(get().activePlugins)
    const instance = next.get(pluginId)
    if (instance) {
      instance.target = target
      set({ activePlugins: next })
    }
  },

  setPluginSlot: (pluginId, slot) => {
    const next = new Map(get().activePlugins)
    const instance = next.get(pluginId)
    if (instance) {
      instance.slot = slot
      set({ activePlugins: next })
    }
  },

  getEffectsForSource: (sourceId) => {
    const { activePlugins } = get()
    const effects: PluginInstance[] = []
    for (const instance of activePlugins.values()) {
      if (
        instance.manifest.type === 'audio-effect' &&
        instance.target === sourceId &&
        instance.enabled
      ) {
        effects.push(instance)
      }
    }
    return effects.sort((a, b) => a.slot - b.slot)
  },

  getMasterEffects: () => {
    const { activePlugins } = get()
    const effects: PluginInstance[] = []
    for (const instance of activePlugins.values()) {
      if (
        instance.manifest.type === 'audio-effect' &&
        instance.target === 'master' &&
        instance.enabled
      ) {
        effects.push(instance)
      }
    }
    return effects.sort((a, b) => a.slot - b.slot)
  },

  getExporterPlugins: () => {
    const { activePlugins } = get()
    return Array.from(activePlugins.values()).filter(
      (instance) => instance.manifest.type === 'exporter' && instance.enabled
    )
  },
}))
