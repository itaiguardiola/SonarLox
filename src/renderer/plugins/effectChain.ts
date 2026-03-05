import type { SourceId } from '../types'
import type { AudioEffectPlugin } from './types'
import { audioEngine } from '../audio/WebAudioEngine'
import { usePluginStore } from './usePluginStore'

/**
 * Rebuilds the audio effect chain for a specific source or the master output.
 */
export function rebuildEffectChain(target: SourceId | 'master'): void {
  if (target === 'master') {
    rebuildMasterEffectChain()
    return
  }

  const nodes = audioEngine.getChannelNodes(target)
  if (!nodes) return

  const { gainNode, pannerNode } = nodes
  gainNode.disconnect()

  const effects = usePluginStore.getState().getEffectsForSource(target)

  if (effects.length === 0) {
    gainNode.connect(pannerNode)
    return
  }

  let lastOutput: AudioNode = gainNode

  for (const instance of effects) {
    try {
      const effectPlugin = instance.plugin as AudioEffectPlugin
      if (typeof effectPlugin.getInputNode !== 'function') continue
      const inputNode = effectPlugin.getInputNode()
      lastOutput.connect(inputNode)
      lastOutput = effectPlugin.getOutputNode()
    } catch (err) {
      console.error(`Failed to connect plugin ${instance.manifest.id}:`, err)
    }
  }

  lastOutput.connect(pannerNode)
}

/** Rebuilds the master output effect chain */
export function rebuildMasterEffectChain(): void {
  const ctx = audioEngine.getAudioContext()
  if (!ctx) return

  const nodes = audioEngine.getMasterNodes()
  if (!nodes) return

  const { masterGainNode, masterAnalyserNode } = nodes
  masterGainNode.disconnect()

  const effects = usePluginStore.getState().getMasterEffects()

  if (effects.length === 0) {
    masterGainNode.connect(masterAnalyserNode)
    return
  }

  let lastOutput: AudioNode = masterGainNode

  for (const instance of effects) {
    try {
      const effectPlugin = instance.plugin as AudioEffectPlugin
      if (typeof effectPlugin.getInputNode !== 'function') continue
      const inputNode = effectPlugin.getInputNode()
      lastOutput.connect(inputNode)
      lastOutput = effectPlugin.getOutputNode()
    } catch (err) {
      console.error(`Failed to connect master plugin ${instance.manifest.id}:`, err)
    }
  }

  lastOutput.connect(masterAnalyserNode)
}

/** Rebuilds effect chains for all active source channels and master */
export function rebuildAllEffectChains(): void {
  const channelIds = audioEngine.getChannelIds()
  for (const id of channelIds) {
    rebuildEffectChain(id)
  }
  rebuildMasterEffectChain()
}
