import type { SourceId, SourcePosition, AudioSource } from '../types'
import type { IAudioEngine } from '../audio/IAudioEngine'

/** Supported plugin types in SonarLox */
export type PluginType = 'audio-effect' | 'visualizer' | 'exporter' | 'source-generator'

/** Parameter types for plugin configuration */
export interface PluginParameterDef {
  id: string
  label: string
  type: 'float' | 'int' | 'boolean' | 'select' | 'file'
  defaultValue: PluginParameterValue
  min?: number
  max?: number
  step?: number
  options?: string[]
}

/** Runtime value of a plugin parameter */
export type PluginParameterValue = number | boolean | string

/** Transport snapshot passed to plugins */
export interface TransportSnapshot {
  isPlaying: boolean
  playheadPosition: number
  duration: number
}

/** Shared context provided to all plugins */
export interface PluginContext {
  audioContext: AudioContext
  audioEngine: IAudioEngine
  sampleRate: number
  /** Current transport state */
  transport: TransportSnapshot
  /** Subscribe to transport state changes (play/pause/seek) */
  onTransportChange: (callback: (state: TransportSnapshot) => void) => () => void
  /** Subscribe to parameter changes */
  onParameterChange: (callback: (id: string, value: PluginParameterValue) => void) => () => void
  /** Logs a message to the host console */
  log: (message: string) => void
}

/** Base interface for all SonarLox plugins */
export interface SonarLoxPlugin {
  activate(context: PluginContext): void
  deactivate(): void
  setParameter(id: string, value: PluginParameterValue): void
  getParameters(): Record<string, PluginParameterValue>
}

/** Audio effect plugin -- processes audio via AudioNodes */
export interface AudioEffectPlugin extends SonarLoxPlugin {
  /** Returns the AudioNode to insert into the chain (input node) */
  getInputNode(): AudioNode
  /** Returns the output node of the effect (may be same as input for single-node effects) */
  getOutputNode(): AudioNode
}

/** Visualizer plugin -- returns geometry data for the host to render */
export interface VisualizerPlugin extends SonarLoxPlugin {
  /** Called each frame with analyser data; returns geometry for host rendering */
  update?(analyserData: Float32Array, sourcePosition: SourcePosition): VisualizerData
  /** (Recommended) Renders geometry directly into the R3F scene */
  render?(props: { sources: AudioSource[]; audioEngine: IAudioEngine }): React.ReactNode
}

export interface VisualizerData {
  geometry: import('three').BufferGeometry
  material: import('three').Material
}

/** Exporter plugin -- renders project to a custom file format */
export interface ExporterPlugin extends SonarLoxPlugin {
  export(): Promise<ArrayBuffer>
}

/** Metadata for a plugin package */
export interface PluginManifest {
  id: string
  name: string
  version: string
  description: string
  author: string
  type: PluginType
  main: string // entry point script
  parameters: PluginParameterDef[]
  ui?: string // optional custom UI panel
}

/** Serialized state of a plugin for project saving */
export interface SerializedPluginState {
  pluginId: string
  parameters: Record<string, PluginParameterValue>
  target: SourceId | 'master'
  slot: number
  enabled: boolean
}

/** Active instance of an activated plugin */
export interface PluginInstance {
  manifest: PluginManifest
  plugin: SonarLoxPlugin
  target: SourceId | 'master'
  slot: number
  enabled: boolean
  parameters: Record<string, PluginParameterValue>
}
