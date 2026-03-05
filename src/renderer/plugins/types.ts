import type { SourceId, SourcePosition } from '../types'

/** Supported plugin types in SonarLox */
export type PluginType = 'audio-effect' | 'visualizer' | 'exporter' | 'source-generator'

/** Parameter types for plugin configuration */
export type PluginParameterType = 'float' | 'int' | 'boolean' | 'select'

/** Defines a single configurable parameter exposed by a plugin */
export interface PluginParameterDef {
  id: string
  label: string
  type: PluginParameterType
  defaultValue: number | boolean | string
  min?: number
  max?: number
  step?: number
  options?: string[]
}

/** Plugin manifest loaded from plugin.json */
export interface PluginManifest {
  id: string
  name: string
  version: string
  description: string
  author: string
  type: PluginType
  main: string
  parameters: PluginParameterDef[]
}

/** Context object passed to plugins providing access to the host environment */
export interface PluginContext {
  audioContext: AudioContext
  audioEngine: any // IAudioEngine
  sampleRate: number
  /** Current transport state */
  transport: {
    isPlaying: boolean
    playheadPosition: number
    duration: number
  }
  /** Subscribe to transport state changes (play/pause/seek) */
  onTransportChange: (callback: (state: any) => void) => () => void
  /** Subscribe to parameter changes */
  onParameterChange: (callback: (id: string, value: PluginParameterValue) => void) => () => void
  /** Logs a message to the host console */
  log: (message: string) => void
}

/** Runtime state for a parameter value */
export type PluginParameterValue = number | boolean | string

/** Base interface all plugins must implement */
export interface SonarLoxPlugin {
  /** Called when the plugin is activated */
  activate(context: PluginContext): void
  /** Called when the plugin is deactivated */
  deactivate(): void
  /** Called when a parameter changes */
  setParameter(id: string, value: PluginParameterValue): void
  /** Returns current parameter values */
  getParameters(): Record<string, PluginParameterValue>
}

/** Audio effect plugin -- inserted between gainNode and pannerNode */
export interface AudioEffectPlugin extends SonarLoxPlugin {
  /** Returns the AudioNode to insert into the chain (input node) */
  getInputNode(): AudioNode
  /** Returns the output node of the effect (may be same as input for single-node effects) */
  getOutputNode(): AudioNode
}

/** Data returned by visualizer plugins for host-side rendering */
export interface VisualizerData {
  points: Array<{ position: [number, number, number]; color: string; size: number }>
  lines: Array<{ start: [number, number, number]; end: [number, number, number]; color: string }>
}

/** Visualizer plugin -- returns geometry data for the host to render */
export interface VisualizerPlugin extends SonarLoxPlugin {
  /** Called each frame with analyser data; returns geometry for host rendering */
  update?(analyserData: Float32Array, sourcePosition: SourcePosition): VisualizerData
  /** (Recommended) Renders geometry directly into the R3F scene */
  render?(props: { sources: any[]; audioEngine: any }): React.ReactNode
}

/** Source data provided to exporter plugins */
export interface ExporterSourceData {
  id: SourceId
  audioBuffer: AudioBuffer
  position: SourcePosition
  volume: number
  label: string
}

/** Exporter plugin -- custom export formats */
export interface ExporterPlugin extends SonarLoxPlugin {
  /** File extension for the exported file (without dot) */
  fileExtension: string
  /** Export label shown in the UI */
  exportLabel: string
  /** Performs the export, returns the file data as ArrayBuffer */
  export(sources: ExporterSourceData[], listenerY: number): Promise<ArrayBuffer>
}

/** Serialized plugin state for project save/load */
export interface SerializedPluginState {
  pluginId: string
  parameters: Record<string, PluginParameterValue>
  target: SourceId | 'master'
  slot: number
  enabled: boolean
}

/** Runtime instance of an activated plugin */
export interface PluginInstance {
  manifest: PluginManifest
  plugin: SonarLoxPlugin
  target: SourceId | 'master'
  slot: number
  enabled: boolean
  parameters: Record<string, PluginParameterValue>
}
