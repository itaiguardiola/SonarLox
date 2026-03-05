import type { AppState, AudioSource, ProjectManifest, SourcePosition, SourceId, SourceAnimation, EasingType } from '../types'
import type { TransportState } from '../types'
import type { SerializedPluginState } from '../plugins/types'
import { encodeWav } from './encodeWav'
import { audioEngine } from './WebAudioEngine'

const FORMAT_VERSION = '1.1.0'
const APP_VERSION = 'SonarLox 1.1.0'

export function buildManifest(
  title: string,
  sources: AudioSource[],
  duration: number,
  sampleRate: number,
  createdAt?: string,
  animations?: Record<SourceId, SourceAnimation>,
): ProjectManifest {
  const now = new Date().toISOString()
  const hasTimeline = animations
    ? Object.values(animations).some((a) => a.keyframes.length > 0)
    : false
  return {
    format: 'sonarlox-project',
    version: FORMAT_VERSION,
    createdWith: APP_VERSION,
    createdAt: createdAt ?? now,
    updatedAt: now,
    title,
    author: '',
    description: '',
    duration,
    sampleRate,
    audioEmbedMode: 'embedded',
    sourceCount: sources.length,
    hasTimeline,
    hasVideoSync: false,
    monitoringMode: 'headphones-hrtf',
  }
}

interface SerializedSource {
  id: string
  label: string
  audioRef: string
  type: string
  position: SourcePosition
  volume: number
  mute: boolean
  solo: boolean
  color: string
  sineFrequency: number
}

interface SerializedState {
  sources: SerializedSource[]
  listener: {
    position: SourcePosition
    orientation: { forward: SourcePosition; up: SourcePosition }
  }
  spatial: {
    distanceModel: string
    refDistance: number
    maxDistance: number
    rolloffFactor: number
    panningModel: string
  }
  room: {
    dimensions: SourcePosition
    showGrid: boolean
    showDistanceRings: boolean
    acoustics: null
  }
  transport: {
    volume: number
    loop: boolean
    playbackPosition: number
  }
  camera: {
    presets: ({ position: SourcePosition; target: SourcePosition } | null)[]
  }
  rendering: {
    monitoringMode: string
  }
  preferences: {
    selectedOutputDevice: string | null
    listenerY: number
  }
}

export function serializeProjectState(
  appState: AppState,
  transportState: TransportState
): string {
  const sources: SerializedSource[] = appState.sources.map((s, i) => ({
    id: s.id,
    label: s.label,
    audioRef: `source_${i}`,
    type: s.sourceType,
    position: s.position,
    volume: s.volume,
    mute: s.isMuted,
    solo: s.isSoloed,
    color: s.color,
    sineFrequency: s.sineFrequency,
  }))

  const state: SerializedState = {
    sources,
    listener: {
      position: [0, appState.listenerY, 0],
      orientation: {
        forward: [0, 0, -1],
        up: [0, 1, 0],
      },
    },
    spatial: {
      distanceModel: 'inverse',
      refDistance: 1.0,
      maxDistance: 50.0,
      rolloffFactor: 1.0,
      panningModel: 'HRTF',
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
      playbackPosition: transportState.playheadPosition,
    },
    camera: {
      presets: appState.cameraPresets,
    },
    rendering: {
      monitoringMode: 'headphones-hrtf',
    },
    preferences: {
      selectedOutputDevice: appState.selectedOutputDevice,
      listenerY: appState.listenerY,
    },
  }

  return JSON.stringify(state, null, 2)
}

export interface DeserializedState {
  sources: AudioSource[]
  listenerY: number
  masterVolume: number
  isLooping: boolean
  roomSize: [number, number]
  cameraPresets: ({ position: [number, number, number]; target: [number, number, number] } | null)[]
  selectedOutputDevice: string | null
}

export function deserializeProjectState(stateJson: Record<string, unknown>): DeserializedState {
  const s = stateJson as unknown as SerializedState

  const sources: AudioSource[] = (s.sources ?? []).map((src) => ({
    id: src.id ?? crypto.randomUUID(),
    label: src.label ?? 'Source',
    sourceType: (src.type as AudioSource['sourceType']) ?? 'file',
    position: src.position ?? [2, 1, 0],
    volume: src.volume ?? 1.0,
    color: src.color ?? '#ff6622',
    audioFileName: null, // Will be set after audio loads
    sineFrequency: src.sineFrequency ?? 440,
    isMuted: src.mute ?? false,
    isSoloed: src.solo ?? false,
  }))

  return {
    sources,
    listenerY: s.preferences?.listenerY ?? s.listener?.position?.[1] ?? 0,
    masterVolume: s.transport?.volume ?? 1.0,
    isLooping: s.transport?.loop ?? true,
    roomSize: [s.room?.dimensions?.[0] ?? 20, s.room?.dimensions?.[2] ?? 20],
    cameraPresets: s.camera?.presets ?? [null, null, null, null],
    selectedOutputDevice: s.preferences?.selectedOutputDevice ?? null,
  }
}

export function serializeAudioSources(
  sources: AudioSource[]
): Array<{ name: string; wavBuffer: ArrayBuffer; meta: string }> {
  const result: Array<{ name: string; wavBuffer: ArrayBuffer; meta: string }> = []

  for (let i = 0; i < sources.length; i++) {
    const source = sources[i]
    const buffer = audioEngine.getAudioBuffer(source.id)
    if (!buffer) continue

    const wavBuffer = encodeWav(buffer)
    const meta = JSON.stringify({
      originalFileName: source.audioFileName ?? `source_${i}.wav`,
      format: 'wav',
      channels: buffer.numberOfChannels,
      sampleRate: buffer.sampleRate,
      bitDepth: 16,
      durationSeconds: buffer.duration,
    }, null, 2)

    result.push({
      name: `source_${i}.wav`,
      wavBuffer,
      meta,
    })
  }

  return result
}

interface SerializedKeyframe {
  time: number
  position: SourcePosition
  easing: EasingType
}

interface SerializedTimeline {
  version: string
  animations: Record<string, { keyframes: SerializedKeyframe[] }>
}

export function serializeTimeline(
  animations: Record<SourceId, SourceAnimation>
): string {
  const serialized: SerializedTimeline = {
    version: '1.1.0',
    animations: {},
  }
  for (const [id, anim] of Object.entries(animations)) {
    if (anim.keyframes.length > 0) {
      serialized.animations[id] = {
        keyframes: anim.keyframes.map((kf) => ({
          time: kf.time,
          position: kf.position,
          easing: kf.easing,
        })),
      }
    }
  }
  return JSON.stringify(serialized, null, 2)
}

export function deserializeTimeline(
  timelineJson: Record<string, unknown>
): Record<SourceId, SourceAnimation> {
  const result: Record<SourceId, SourceAnimation> = {}

  // Handle v1.0 (empty placeholder) gracefully
  const data = timelineJson as unknown as SerializedTimeline
  if (!data.animations) return result

  for (const [id, anim] of Object.entries(data.animations)) {
    if (!anim?.keyframes?.length) continue
    result[id] = {
      sourceId: id,
      keyframes: anim.keyframes.map((kf) => ({
        time: kf.time ?? 0,
        position: kf.position ?? [0, 0, 0],
        easing: kf.easing ?? 'linear',
      })),
    }
  }

  return result
}

/** Serializes active plugin state for project save */
export function serializePluginState(activePlugins: Map<string, {
  manifest: { id: string }
  parameters: Record<string, number | boolean | string>
  target: string
  slot: number
  enabled: boolean
}>): SerializedPluginState[] {
  const result: SerializedPluginState[] = []
  for (const [, instance] of activePlugins) {
    result.push({
      pluginId: instance.manifest.id,
      parameters: { ...instance.parameters },
      target: instance.target as SourceId | 'master',
      slot: instance.slot,
      enabled: instance.enabled,
    })
  }
  return result
}

/** Deserializes plugin state from project data */
export function deserializePluginState(
  data: Record<string, unknown> | undefined
): SerializedPluginState[] {
  if (!data) return []
  const plugins = (data as { plugins?: unknown[] }).plugins
  if (!Array.isArray(plugins)) return []

  return plugins
    .filter((p): p is Record<string, unknown> => p !== null && typeof p === 'object')
    .map((p) => ({
      pluginId: (p.pluginId as string) ?? '',
      parameters: (p.parameters as Record<string, number | boolean | string>) ?? {},
      target: (p.target as SourceId | 'master') ?? 'master',
      slot: (p.slot as number) ?? 0,
      enabled: (p.enabled as boolean) ?? true,
    }))
    .filter((p) => p.pluginId !== '')
}
