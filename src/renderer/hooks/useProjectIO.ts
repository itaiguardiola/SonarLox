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
    // Inject plugin state into the state JSON
    const stateObj = JSON.parse(stateJsonRaw)
    const pluginState = usePluginStore.getState().activePlugins
    stateObj.plugins = serializePluginState(pluginState)
    const stateJson = JSON.stringify(stateObj, null, 2)
    const audioFiles = serializeAudioSources(appState.sources)
    const duration = audioEngine.getDuration()
    const sampleRate = 44100 // Default; could read from first buffer

    const manifest = buildManifest(
      appState.projectTitle,
      appState.sources,
      duration,
      sampleRate,
      undefined,
      appState.animations,
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
      if (response === 2) return // Cancel
      if (response === 0) await saveProject() // Save first
    }

    const result = await window.api.openProject()
    if (!result) return

    // Stop playback
    useTransportStore.getState().stop()

    // Clear existing audio channels
    for (const id of audioEngine.getChannelIds()) {
      audioEngine.removeChannel(id)
    }

    // Deserialize state and timeline
    const deserialized = deserializeProjectState(result.state)
    const animations = deserializeTimeline(result.timeline)

    // Map source index to audio file
    const audioFileMap = new Map<number, { buffer: ArrayBuffer; meta: Record<string, unknown> }>()
    for (const af of result.audioFiles) {
      const match = af.name.match(/source_(\d+)\.wav/)
      if (match) {
        audioFileMap.set(parseInt(match[1]), { buffer: af.buffer, meta: af.meta })
      }
    }

    // Initialize audio engine
    await audioEngine.init()

    // Restore sources with audio
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

    // Restore store state
    useAppStore.setState({
      sources: deserialized.sources,
      selectedSourceId: deserialized.sources[0]?.id ?? null,
      listenerY: deserialized.listenerY,
      masterVolume: deserialized.masterVolume,
      isLooping: deserialized.isLooping,
      roomSize: deserialized.roomSize,
      cameraPresets: deserialized.cameraPresets,
      selectedOutputDevice: deserialized.selectedOutputDevice,
      currentProjectPath: result.filePath,
      projectTitle: (result.manifest.title as string) || 'Untitled',
      animations,
      isRecordingKeyframes: false,
      isDirty: false,
    })

    audioEngine.setLooping(deserialized.isLooping)
    audioEngine.setMasterVolume(deserialized.masterVolume)
    audioEngine.setListenerY(deserialized.listenerY)

    // Restore plugin state
    const pluginStore = usePluginStore.getState()
    // Deactivate all current plugins
    for (const [id] of pluginStore.activePlugins) {
      unloadPlugin(id)
      pluginStore.deactivatePlugin(id)
    }
    // Load saved plugins
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
        } catch {
          // Plugin not available -- skip silently
        }
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
      if (response === 2) return // Cancel
      if (response === 0) await saveProject() // Save first
    }

    // Stop playback
    useTransportStore.getState().stop()

    // Clear audio
    for (const id of audioEngine.getChannelIds()) {
      audioEngine.removeChannel(id)
    }

    // Reset store to defaults
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
        sineFrequency: 440,
        isMuted: false,
        isSoloed: false,
      }],
      selectedSourceId: newId,
      listenerY: 0,
      masterVolume: 1.0,
      isLooping: true,
      roomSize: [20, 20],
      cameraPresets: [null, null, null, null],
      currentProjectPath: null,
      projectTitle: 'Untitled',
      isDirty: false,
      soundFontName: null,
      animations: {},
      isRecordingKeyframes: false,
    })

    audioEngine.setLooping(true)
    audioEngine.setMasterVolume(1.0)
    audioEngine.setListenerY(0)

    // Deactivate all plugins
    const pluginStore = usePluginStore.getState()
    for (const [id] of pluginStore.activePlugins) {
      unloadPlugin(id)
      pluginStore.deactivatePlugin(id)
    }
  }, [saveProject])

  return { saveProject, openProject, newProject }
}
