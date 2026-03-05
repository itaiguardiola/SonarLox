import type { SourceId } from '../types'
import type { AudioEffectPlugin } from './types'
import { audioEngine } from '../audio/WebAudioEngine'
import { usePluginStore } from './usePluginStore'

/**
 * Rebuilds the audio effect chain for a specific source or the master output.
 * Disconnects the starting node, inserts effect nodes in slot order,
 * then reconnects to the ending node.
 */
export function rebuildEffectChain(target: SourceId | 'master'): void {
  if (target === 'master') {
    rebuildMasterEffectChain()
    return
  }

  const nodes = audioEngine.getChannelNodes(target)
  if (!nodes) return

  const { gainNode, pannerNode } = nodes

  // Disconnect gainNode from everything
  gainNode.disconnect()

  // Get sorted effect instances for this source
  const effects = usePluginStore.getState().getEffectsForSource(target)

  if (effects.length === 0) {
    // Direct connection: gain -> panner
    gainNode.connect(pannerNode)
    return
  }

  // Chain effects: gain -> effect1.input ... effect1.output -> effect2.input ... -> panner
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
      // Skip this effect and continue the chain
    }
  }

  lastOutput.connect(pannerNode)
}

/** Rebuilds the master output effect chain */
export function rebuildMasterEffectChain(): void {
  const ctx = audioEngine.getAudioContext()
  if (!ctx) return

  // In WebAudioEngine, the master chain is:
  // masterGainNode -> [master effects] -> masterAnalyserNode -> destination
  
  const nodes = (audioEngine as any).getMasterNodes?.()
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
