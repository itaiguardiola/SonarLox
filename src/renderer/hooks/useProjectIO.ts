import { useCallback } from 'react'
import { useAppStore } from '../stores/useAppStore'
import { useTransportStore } from '../stores/useTransportStore'
import { audioEngine } from '../audio/WebAudioEngine'
import {
  buildManifest,
  serializeProjectState,
  serializeAudioSources,
  deserializeProjectState,
  serializeTimeline,
  deserializeTimeline,
  serializePluginState,
  deserializePluginState,
} from '../audio/projectSerializer'
import { encodeWav } from '../audio/encodeWav'
import { usePluginStore } from '../plugins/usePluginStore'
import { loadPlugin, unloadPlugin } from '../plugins/pluginLoader'
import { rebuildAllEffectChains } from '../plugins/effectChain'

export function useProjectIO() {
  const saveProject = useCallback(async (saveAs?: boolean) => {
    if (!window.api) return

    const appState = useAppStore.getState()
    let filePath = appState.currentProjectPath

    if (!filePath || saveAs) {
      const chosen = await window.api.saveProjectDialog()
      if (!chosen) return
      filePath = chosen
    }

    const transportState = useTransportStore.getState()
    const stateJsonRaw = serializeProjectState(appState, transportState)
    const stateObj = JSON.parse(stateJsonRaw)
    const pluginState = usePluginStore.getState().activePlugins
    stateObj.plugins = serializePluginState(pluginState)
    const stateJson = JSON.stringify(stateObj, null, 2)
    const audioSourceMap = serializeAudioSources(appState.sources)
    const audioFiles: Array<{ name: string; wavBuffer: ArrayBuffer; meta: string }> = []
    for (const entry of audioSourceMap) {
      const audioBuf = audioEngine.getAudioBuffer(entry.id)
      if (!audioBuf) continue
      const source = appState.sources.find((s) => s.id === entry.id)
      audioFiles.push({
        name: entry.name,
        wavBuffer: encodeWav(audioBuf),
        meta: JSON.stringify({ originalFileName: source?.audioFileName ?? entry.name }),
      })
    }
    const duration = audioEngine.getDuration()
    const sampleRate = 44100

    const manifest = buildManifest(
      appState.projectTitle,
      appState.sources,
      duration,
      sampleRate,
      undefined,
      appState.animations,
      appState.videoFilePath,
    )
    const manifestJson = JSON.stringify(manifest, null, 2)
    const timelineJson = serializeTimeline(appState.animations)

    const result = await window.api.saveProject({
      filePath,
      manifest: manifestJson,
      state: stateJson,
      timeline: timelineJson,
      audioFiles,
    })

    if (result.saved) {
      useAppStore.setState({
        currentProjectPath: result.path,
        isDirty: false,
      })
    }
  }, [])

  const openProject = useCallback(async () => {
    if (!window.api) return

    const appState = useAppStore.getState()
    if (appState.isDirty && window.api.showConfirmDialog) {
      const response = await window.api.showConfirmDialog({
        message: 'You have unsaved changes.',
        detail: 'Save before opening a different project?',
        buttons: ['Save', 'Discard', 'Cancel'],
        defaultId: 0,
        cancelId: 2,
      })
      if (response === 2) return
      if (response === 0) await saveProject()
    }

    const result = await window.api.openProject()
    if (!result) return

    useTransportStore.getState().stop()

    for (const id of audioEngine.getChannelIds()) {
      audioEngine.removeChannel(id)
    }

    const deserialized = deserializeProjectState(result.state)
    const animations = deserializeTimeline(result.timeline)

    const audioFileMap = new Map<number, { buffer: ArrayBuffer; meta: Record<string, unknown> }>()
    for (const af of result.audioFiles) {
      const match = af.name.match(/source_(\d+)\.wav/)
      if (match) {
        audioFileMap.set(parseInt(match[1]), { buffer: af.buffer, meta: af.meta })
      }
    }

    await audioEngine.init()

    for (let i = 0; i < deserialized.sources.length; i++) {
      const source = deserialized.sources[i]
      audioEngine.createChannel(source.id)

      const audioFile = audioFileMap.get(i)
      if (audioFile) {
        try {
          await audioEngine.loadFile(source.id, audioFile.buffer)
          const meta = audioFile.meta as { originalFileName?: string }
          source.audioFileName = meta.originalFileName ?? `source_${i}.wav`
        } catch (err) {
          console.error(`Failed to decode audio for source ${i}:`, err)
        }
      }
    }

    useAppStore.setState({
      sources: deserialized.sources,
      selectedSourceId: deserialized.sources[0]?.id ?? null,
      listenerY: deserialized.listenerY,
      masterVolume: deserialized.masterVolume,
      isLooping: deserialized.isLooping,
      roomSize: deserialized.roomSize,
      bpm: deserialized.bpm,
      cameraPresets: deserialized.cameraPresets,
      selectedOutputDevice: deserialized.selectedOutputDevice,
      currentProjectPath: result.filePath,
      projectTitle: (result.manifest.title as string) || 'Untitled',
      animations,
      isRecordingKeyframes: false,
      isDirty: false,
      videoFilePath: null,
      videoFileName: deserialized.video.fileName,
      videoOffset: deserialized.video.offset,
      videoFrameRate: deserialized.video.frameRate,
      videoOpacity: deserialized.video.opacity,
      isVideoVisible: deserialized.video.visible,
      videoScreenPosition: deserialized.video.screenPosition,
      videoScreenScale: deserialized.video.screenScale,
      videoScreenLocked: deserialized.video.screenLocked,
      videoScreenVisible: deserialized.video.screenVisible,
    })

    audioEngine.setLooping(deserialized.isLooping)
    audioEngine.setMasterVolume(deserialized.masterVolume)
    audioEngine.setListenerY(deserialized.listenerY)

    const pluginStore = usePluginStore.getState()
    for (const [id] of pluginStore.activePlugins) {
      unloadPlugin(id)
      pluginStore.deactivatePlugin(id)
    }
    
    const savedPlugins = deserializePluginState(result.state)
    if (savedPlugins.length > 0) {
      const available = pluginStore.availablePlugins
      for (const sp of savedPlugins) {
        const manifest = available.find((m) => m.id === sp.pluginId)
        if (!manifest) continue
        try {
          const instance = await loadPlugin(manifest)
          instance.target = sp.target
          instance.slot = sp.slot
          instance.enabled = sp.enabled
          for (const [paramId, value] of Object.entries(sp.parameters)) {
            instance.parameters[paramId] = value
            instance.plugin.setParameter(paramId, value)
          }
          pluginStore.activatePlugin(instance)
        } catch { /* skip */ }
      }
      rebuildAllEffectChains()
    }
  }, [saveProject])

  const newProject = useCallback(async () => {
    const appState = useAppStore.getState()
    if (appState.isDirty && window.api?.showConfirmDialog) {
      const response = await window.api.showConfirmDialog({
        message: 'You have unsaved changes.',
        detail: 'Save before creating a new project?',
        buttons: ['Save', 'Discard', 'Cancel'],
        defaultId: 0,
        cancelId: 2,
      })
      if (response === 2) return
      if (response === 0) await saveProject()
    }

    useTransportStore.getState().stop()

    for (const id of audioEngine.getChannelIds()) {
      audioEngine.removeChannel(id)
    }

    const newId = crypto.randomUUID()
    useAppStore.setState({
      sources: [{
        id: newId,
        label: 'Source 1',
        sourceType: 'file',
        position: [2, 1, 0],
        volume: 1.0,
        color: '#ff6622',
        audioFileName: null,
        audioFilePath: null,
        sineFrequency: 440,
        isMuted: false,
        isSoloed: false,
      }],
      selectedSourceId: newId,
      listenerY: 0,
      masterVolume: 1.0,
      isLooping: true,
      roomSize: [20, 20],
      bpm: 120,
      cameraPresets: [null, null, null, null],
      currentProjectPath: null,
      projectTitle: 'Untitled',
      isDirty: false,
      soundFontName: null,
      animations: {},
      isRecordingKeyframes: false,
      videoFilePath: null,
      videoFileName: null,
      videoOffset: 0,
      videoFrameRate: 24,
      videoOpacity: 1.0,
      isVideoVisible: true,
      videoScreenPosition: [0, 3, -4],
      videoScreenScale: 3,
      videoScreenLocked: false,
      videoScreenVisible: true,
    })

    audioEngine.setLooping(true)
    audioEngine.setMasterVolume(1.0)
    audioEngine.setListenerY(0)

    const pluginStore = usePluginStore.getState()
    for (const [id] of pluginStore.activePlugins) {
      unloadPlugin(id)
      pluginStore.deactivatePlugin(id)
    }
  }, [saveProject])

  return { saveProject, openProject, newProject }
}
