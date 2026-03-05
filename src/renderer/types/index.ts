export type SourcePosition = [number, number, number]

/**
 * Unique identifier for audio sources in the spatial audio editor
 */
export type SourceId = string

/**
 * Easing types for animation keyframes in spatial audio
 */
export type EasingType = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out'

/**
 * Keyframe representing a position change at a specific time with easing
 */
export interface Keyframe {
  time: number
  position: SourcePosition
  easing: EasingType
}

/**
 * Animation data for a specific audio source with its keyframes
 */
export interface SourceAnimation {
  sourceId: SourceId
  keyframes: Keyframe[]
}

/**
 * Predefined color palette for audio source visualization
 */
export const SOURCE_COLORS = [
  '#ff6622', '#2288ff', '#22cc44', '#ff2266',
  '#ffcc00', '#aa44ff', '#00cccc', '#ff8844',
] as const

/**
 * Maximum number of audio sources supported in the editor
 */
export const MAX_SOURCES = 8

/**
 * Types of audio sources available in the editor
 */
export type SourceType = 'file' | 'tone' | 'midi-track'

/**
 * Audio source configuration with position, volume, and playback settings
 */
export interface AudioSource {
  id: SourceId
  label: string
  sourceType: SourceType
  position: SourcePosition
  volume: number
  color: string
  audioFileName: string | null
  sineFrequency: number
  isMuted: boolean
  isSoloed: boolean
}

/**
 * Transport state for playback controls and position tracking
 */
export interface TransportState {
  isPlaying: boolean
  isPaused: boolean
  playheadPosition: number
  duration: number
  isLooping: boolean
}

/**
 * Camera preset configuration with position and target for 3D view
 */
export interface CameraPreset {
  position: [number, number, number]
  target: [number, number, number]
}

/**
 * Camera command for controlling camera presets and navigation
 */
export type CameraCommand =
  | { type: 'home' }
  | { type: 'recall'; index: number }
  | { type: 'save'; index: number }
  | null

/**
 * Application state management for the SonarLox spatial audio editor
 */
export interface AppState {
  // Multi-source
  sources: AudioSource[]
  selectedSourceId: SourceId | null
  addSource: (type: SourceType) => void
  removeSource: (id: SourceId) => void
  selectSource: (id: SourceId | null) => void
  setSourcePosition: (id: SourceId, position: SourcePosition) => void
  setSourceVolume: (id: SourceId, volume: number) => void
  setSourceAudioFileName: (id: SourceId, name: string | null) => void
  setSourceSineFrequency: (id: SourceId, freq: number) => void
  setSourceMuted: (id: SourceId, muted: boolean) => void
  setSourceSoloed: (id: SourceId, soloed: boolean) => void
  setSourceLabel: (id: SourceId, label: string) => void

  // SoundFont
  soundFontName: string | null
  setSoundFontName: (name: string | null) => void

  // Global playback
  isPlaying: boolean
  isLooping: boolean
  listenerY: number
  roomSize: [number, number] // [width, depth]
  setIsPlaying: (isPlaying: boolean) => void
  setIsLooping: (isLooping: boolean) => void
  setListenerY: (y: number) => void
  setRoomSize: (size: [number, number]) => void

  // Master output
  masterVolume: number
  setMasterVolume: (vol: number) => void
  selectedOutputDevice: string | null
  setSelectedOutputDevice: (id: string | null) => void

  // Project
  currentProjectPath: string | null
  projectTitle: string
  isDirty: boolean
  setCurrentProjectPath: (path: string | null) => void
  setProjectTitle: (title: string) => void
  markDirty: () => void
  markClean: () => void

  // Animation
  animations: Record<SourceId, SourceAnimation>
  isRecordingKeyframes: boolean
  recordQuantize: number
  setKeyframe: (sourceId: SourceId, time: number, position: SourcePosition, easing?: EasingType) => void
  removeKeyframe: (sourceId: SourceId, time: number) => void
  clearAnimation: (sourceId: SourceId) => void
  setIsRecordingKeyframes: (v: boolean) => void
  setRecordQuantize: (q: number) => void

  // Export
  isExporting: boolean
  setIsExporting: (v: boolean) => void
  exportProgress: number
  setExportProgress: (p: number) => void

  // Camera
  cameraPresets: (CameraPreset | null)[]
  setCameraPreset: (index: number, preset: CameraPreset | null) => void
  cameraCommand: CameraCommand
  setCameraCommand: (cmd: CameraCommand) => void

  // Video
  videoFilePath: string | null
  videoFileName: string | null
  videoOffset: number
  videoFrameRate: number
  isVideoVisible: boolean
  videoOpacity: number
  videoScreenPosition: SourcePosition
  videoScreenScale: number
  videoScreenLocked: boolean
  videoScreenVisible: boolean
  setVideoFile: (path: string, name: string) => void
  clearVideo: () => void
  setVideoOffset: (offset: number) => void
  setVideoFrameRate: (rate: number) => void
  setIsVideoVisible: (visible: boolean) => void
  setVideoOpacity: (opacity: number) => void
  setVideoScreenPosition: (pos: SourcePosition) => void
  setVideoScreenScale: (scale: number) => void
  setVideoScreenLocked: (locked: boolean) => void
  setVideoScreenVisible: (visible: boolean) => void

  // History (Undo/Redo)
  undoStack: HistoryState[]
  redoStack: HistoryState[]
  recordHistory: (label?: string) => void
  undo: () => void
  redo: () => void
}

/**
 * Snapshot of undoable state
 */
export interface HistoryState {
  label: string
  sources: AudioSource[]
  animations: Record<SourceId, SourceAnimation>
  pluginState: import('../plugins/types').SerializedPluginState[]
  roomSize: [number, number]
}

/**
 * Result from opening an audio file in the editor
 */
export interface AudioFileResult {
  buffer: ArrayBuffer
  name: string
}

/**
 * Result from saving a WAV file
 */
export interface SaveWavResult {
  saved: boolean
  path?: string
}

/**
 * Project manifest containing metadata about the project
 */
export interface ProjectManifest {
  format: 'sonarlox-project'
  version: string
  createdWith: string
  createdAt: string
  updatedAt: string
  title: string
  author: string
  description: string
  duration: number
  sampleRate: number
  audioEmbedMode: 'embedded' | 'referenced'
  sourceCount: number
  hasTimeline: boolean
  hasVideoSync: boolean
  monitoringMode: string
}

/**
 * Data structure for saving a project including all necessary components
 */
export interface ProjectSaveData {
  filePath: string
  manifest: string
  state: string
  timeline: string
  audioFiles: Array<{ name: string; wavBuffer: ArrayBuffer; meta: string }>
}

/**
 * Result from opening a project file
 */
export interface ProjectOpenResult {
  manifest: ProjectManifest
  state: Record<string, unknown>
  timeline: Record<string, unknown>
  audioFiles: Array<{ name: string; buffer: ArrayBuffer; meta: Record<string, unknown> }>
  filePath: string
}

/**
 * Electron API interface for communication between renderer and main processes
 */
export interface ElectronAPI {
  openAudioFile: () => Promise<AudioFileResult | null>
  openMidiFile: () => Promise<AudioFileResult | null>
  openSoundFontFile: () => Promise<AudioFileResult | null>
  saveWavFile: (buffer: ArrayBuffer, defaultPath?: string) => Promise<SaveWavResult>
  selectDirectory: () => Promise<string | null>
  saveWavFileToPath: (buffer: ArrayBuffer, filePath: string, expectedDir?: string) => Promise<SaveWavResult>
  saveProject: (data: ProjectSaveData) => Promise<{ saved: boolean; path: string }>
  openProject: () => Promise<ProjectOpenResult | null>
  saveProjectDialog: () => Promise<string | null>
  showConfirmDialog: (options: {
    message: string
    detail?: string
    buttons?: string[]
    defaultId?: number
    cancelId?: number
  }) => Promise<number>
  openVideoFile: () => Promise<{ filePath: string; name: string } | null>
  scanPlugins: () => Promise<import('../plugins/types').PluginManifest[]>
  readPluginScript: (pluginId: string) => Promise<string | null>
  getPluginsDir: () => Promise<string>
}

declare global {
  interface Window {
    api: ElectronAPI
  }
}
