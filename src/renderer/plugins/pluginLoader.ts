import * as React from 'react'
import * as THREE from 'three'
import type {
  PluginManifest,
  PluginInstance,
  PluginContext,
  SonarLoxPlugin,
  PluginParameterValue,
} from './types'
import { audioEngine } from '../audio/WebAudioEngine'
import { useTransportStore } from '../stores/useTransportStore'

const pluginCache = new Map<string, SonarLoxPlugin>()
const cleanupCache = new Map<string, () => void>()

/** Loads and activates a plugin from its manifest */
export async function loadPlugin(manifest: PluginManifest): Promise<PluginInstance> {
  const script = await window.api.readPluginScript(manifest.id)
  if (!script) {
    throw new Error(`Failed to read script for plugin: ${manifest.id}`)
  }

  const ctx = audioEngine.getAudioContext()
  if (!ctx) {
    throw new Error('AudioContext not available')
  }

  // Execute plugin script using CommonJS-style module pattern
  const exports: Record<string, unknown> = {}
  const module = { exports }
  const fn = new Function('exports', 'module', 'React', 'THREE', script)
  fn(exports, module, React, THREE)

  const PluginClass = (module.exports as { default?: unknown }).default ?? module.exports
  if (typeof PluginClass !== 'function') {
    throw new Error(`Plugin ${manifest.id} does not export a constructor`)
  }

  const transportListeners = new Set<(state: any) => void>()
  const paramListeners = new Set<(id: string, val: any) => void>()

  const transportUnsub = useTransportStore.subscribe((state) => {
    const transportInfo = {
      isPlaying: state.isPlaying,
      playheadPosition: state.playheadPosition,
      duration: state.duration,
    }
    transportListeners.forEach(cb => cb(transportInfo))
  })

  const pluginContext: PluginContext = {
    audioContext: ctx,
    audioEngine: audioEngine,
    sampleRate: ctx.sampleRate,
    transport: {
      isPlaying: useTransportStore.getState().isPlaying,
      playheadPosition: useTransportStore.getState().playheadPosition,
      duration: useTransportStore.getState().duration,
    },
    onTransportChange: (cb) => {
      transportListeners.add(cb)
      return () => transportListeners.delete(cb)
    },
    onParameterChange: (cb) => {
      paramListeners.add(cb)
      return () => paramListeners.delete(cb)
    },
    log: (msg) => console.log(`[Plugin:${manifest.id}]`, msg)
  }

  const plugin = new (PluginClass as new () => SonarLoxPlugin)()
  plugin.activate(pluginContext)

  // Wrap setParameter to trigger listeners
  const originalSetParameter = plugin.setParameter.bind(plugin)
  plugin.setParameter = (id, val) => {
    originalSetParameter(id, val)
    paramListeners.forEach(cb => cb(id, val))
  }

  // Set default parameter values
  const parameters: Record<string, PluginParameterValue> = {}
  for (const param of manifest.parameters) {
    parameters[param.id] = param.defaultValue
    plugin.setParameter(param.id, param.defaultValue)
  }

  pluginCache.set(manifest.id, plugin)
  cleanupCache.set(manifest.id, () => {
    transportUnsub()
    transportListeners.clear()
    paramListeners.clear()
  })

  return {
    manifest,
    plugin,
    target: 'master',
    slot: 0,
    enabled: true,
    parameters,
  }
}

/** Unloads and deactivates a plugin */
export function unloadPlugin(pluginId: string): void {
  const plugin = pluginCache.get(pluginId)
  if (plugin) {
    plugin.deactivate()
    pluginCache.delete(pluginId)
  }
  const cleanup = cleanupCache.get(pluginId)
  if (cleanup) {
    cleanup()
    cleanupCache.delete(pluginId)
  }
}
