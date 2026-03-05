import type { AppState, AudioSource, ProjectManifest, SourceId, SourceAnimation, SourceType } from '../types'
import type { TransportState } from '../types'
import type { SerializedPluginState, PluginInstance } from '../plugins/types'

/**
 * Interface representing the complete serialized state of a SonarLox project.
 */
export interface SerializedState {
  version: string
  sources: Array<{
    id: string
    label: string
    type: string
    position: [number, number, number]
    volume: number
    color: string
    audioFile?: string
    sineFrequency?: number
    muted: boolean
    soloed: boolean
  }>
  listener?: {
    position: [number, number, number]
    orientation: [number, number, number]
  }
  room?: {
    dimensions: [number, number, number]
    showGrid: boolean
    showDistanceRings: boolean
    acoustics: Record<string, unknown> | null
  }
  transport?: {
    volume: number
    loop: boolean
    bpm?: number
  }
  preferences?: {
    listenerY: number
    selectedOutputDevice: string | null
  }
  camera?: {
    presets: Array<{ position: [number, number, number]; target: [number, number, number] } | null>
  }
  plugins?: SerializedPluginState[]
  video?: {
    fileName: string | null
    offset: number
    frameRate: number
    opacity: number
    visible: boolean
    screenPosition: [number, number, number]
    screenScale: number
    screenLocked: boolean
    screenVisible: boolean
  }
}

export function serializeProjectState(appState: AppState, transportState: TransportState): string {
  const state: SerializedState = {
    version: '1.0',
    sources: appState.sources.map((src) => ({
      id: src.id,
      label: src.label,
      type: src.sourceType,
      position: src.position,
      volume: src.volume,
      color: src.color,
      audioFile: src.audioFileName ?? undefined,
      sineFrequency: src.sineFrequency,
      muted: src.isMuted,
      soloed: src.isSoloed,
    })),
    listener: {
      position: [0, appState.listenerY, 0],
      orientation: [0, 0, -1],
    },
    room: {
      dimensions: [appState.roomSize[0], 10, appState.roomSize[1]],
      showGrid: true,
      showDistanceRings: true,
      acoustics: null,
    },
    transport: {
      volume: appState.masterVolume,
      loop: transportState.isLooping,
      bpm: appState.bpm,
    },
    preferences: {
      listenerY: appState.listenerY,
      selectedOutputDevice: appState.selectedOutputDevice,
    },
    camera: {
      presets: appState.cameraPresets,
    },
    video: {
      fileName: appState.videoFileName,
      offset: appState.videoOffset,
      frameRate: appState.videoFrameRate,
      opacity: appState.videoOpacity,
      visible: appState.isVideoVisible,
      screenPosition: appState.videoScreenPosition,
      screenScale: appState.videoScreenScale,
      screenLocked: appState.videoScreenLocked,
      screenVisible: appState.videoScreenVisible,
    },
  }

  return JSON.stringify(state, null, 2)
}

export function serializeAudioSources(sources: AudioSource[]): Array<{ id: SourceId; name: string }> {
  return sources
    .filter((s) => s.audioFileName !== null)
    .map((s, i) => ({
      id: s.id,
      name: `source_${i}.wav`,
    }))
}

export interface DeserializedState {
  sources: AudioSource[]
  listenerY: number
  masterVolume: number
  isLooping: boolean
  bpm: number
  roomSize: [number, number]
  cameraPresets: ({ position: [number, number, number]; target: [number, number, number] } | null)[]
  selectedOutputDevice: string | null
  video: {
    fileName: string | null
    offset: number
    frameRate: number
    opacity: number
    visible: boolean
    screenPosition: [number, number, number]
    screenScale: number
    screenLocked: boolean
    screenVisible: boolean
  }
}

export function deserializeProjectState(stateJson: Record<string, unknown>): DeserializedState {
  const s = stateJson as unknown as SerializedState

  const sources: AudioSource[] = (s.sources ?? []).map((src) => ({
    id: src.id,
    label: src.label,
    sourceType: (src.type as SourceType) ?? 'file',
    position: src.position ?? [0, 1, 0],
    volume: src.volume ?? 1.0,
    color: src.color ?? '#ff6622',
    audioFileName: src.audioFile ?? null,
    audioFilePath: null,
    sineFrequency: src.sineFrequency ?? 440,
    isMuted: src.muted ?? false,
    isSoloed: src.soloed ?? false,
  }))

  return {
    sources,
    listenerY: s.preferences?.listenerY ?? s.listener?.position?.[1] ?? 0,
    masterVolume: s.transport?.volume ?? 1.0,
    isLooping: s.transport?.loop ?? true,
    bpm: s.transport?.bpm ?? 120,
    roomSize: [s.room?.dimensions?.[0] ?? 20, s.room?.dimensions?.[2] ?? 20],
    cameraPresets: s.camera?.presets ?? [null, null, null, null],
    selectedOutputDevice: s.preferences?.selectedOutputDevice ?? null,
    video: {
      fileName: s.video?.fileName ?? null,
      offset: s.video?.offset ?? 0,
      frameRate: s.video?.frameRate ?? 24,
      opacity: s.video?.opacity ?? 1.0,
      visible: s.video?.visible ?? true,
      screenPosition: s.video?.screenPosition ?? [0, 3, -4],
      screenScale: s.video?.screenScale ?? 3,
      screenLocked: s.video?.screenLocked ?? false,
      screenVisible: s.video?.screenVisible ?? true,
    },
  }
}

export function buildManifest(
  title: string,
  sources: AudioSource[],
  duration: number,
  sampleRate: number,
  author = 'User',
  animations: Record<SourceId, SourceAnimation>,
  videoFilePath: string | null = null,
): ProjectManifest {
  return {
    format: 'sonarlox-project',
    version: '1.1',
    createdWith: 'SonarLox v1.1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    title,
    author,
    description: '',
    duration,
    sampleRate,
    audioEmbedMode: 'embedded',
    sourceCount: sources.length,
    hasTimeline: Object.keys(animations).length > 0,
    hasVideoSync: videoFilePath !== null,
    monitoringMode: 'binaural',
  }
}

export function serializeTimeline(animations: Record<SourceId, SourceAnimation>): string {
  return JSON.stringify(animations, null, 2)
}

export function deserializeTimeline(timelineJson: Record<string, unknown>): Record<SourceId, SourceAnimation> {
  return timelineJson as Record<SourceId, SourceAnimation>
}

export function serializePluginState(activePlugins: Map<string, PluginInstance>): SerializedPluginState[] {
  return Array.from(activePlugins.values()).map((instance) => ({
    pluginId: instance.manifest.id,
    parameters: instance.parameters,
    target: instance.target,
    slot: instance.slot,
    enabled: instance.enabled,
  }))
}

export function deserializePluginState(stateJson: Record<string, unknown>): SerializedPluginState[] {
  const plugins = (stateJson as Record<string, unknown>).plugins as Record<string, unknown>[] | undefined
  if (!plugins || !Array.isArray(plugins)) return []

  return plugins
    .map((p) => ({
      pluginId: (p.pluginId as string) ?? '',
      parameters: (p.parameters as Record<string, number | boolean | string>) ?? {},
      target: (p.target as SourceId | 'master') ?? 'master',
      slot: (p.slot as number) ?? 0,
      enabled: (p.enabled as boolean) ?? true,
    }))
    .filter((p) => p.pluginId !== '')
}
