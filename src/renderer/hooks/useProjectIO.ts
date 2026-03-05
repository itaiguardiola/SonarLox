import { useCallback } from 'react'
import { useAppStore } from '../stores/useAppStore'
import { useTransportStore } from '../stores/useTransportStore'
import { audioEngine } from '../audio/WebAudioEngine'
import {
  buildManifest,
  serializeProjectState,
  serializeAudioSources,
  deserializeProjectState,
} from '../audio/projectSerializer'

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
    const stateJson = serializeProjectState(appState, transportState)
    const audioFiles = serializeAudioSources(appState.sources)
    const duration = audioEngine.getDuration()
    const sampleRate = 44100 // Default; could read from first buffer

    const manifest = buildManifest(
      appState.projectTitle,
      appState.sources,
      duration,
      sampleRate,
    )
    const manifestJson = JSON.stringify(manifest, null, 2)
    const timelineJson = JSON.stringify({ version: '1.0.0', tracks: [] }, null, 2)

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
    if (appState.isDirty) {
      const confirmed = window.confirm('You have unsaved changes. Open a different project?')
      if (!confirmed) return
    }

    const result = await window.api.openProject()
    if (!result) return

    // Stop playback
    useTransportStore.getState().stop()

    // Clear existing audio channels
    for (const id of audioEngine.getChannelIds()) {
      audioEngine.removeChannel(id)
    }

    // Deserialize state
    const deserialized = deserializeProjectState(result.state)

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
      cameraPresets: deserialized.cameraPresets,
      selectedOutputDevice: deserialized.selectedOutputDevice,
      currentProjectPath: result.filePath,
      projectTitle: (result.manifest.title as string) || 'Untitled',
      isDirty: false,
    })

    audioEngine.setLooping(deserialized.isLooping)
    audioEngine.setMasterVolume(deserialized.masterVolume)
    audioEngine.setListenerY(deserialized.listenerY)
  }, [])

  const newProject = useCallback(() => {
    const appState = useAppStore.getState()
    if (appState.isDirty) {
      const confirmed = window.confirm('You have unsaved changes. Create a new project?')
      if (!confirmed) return
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
      cameraPresets: [null, null, null, null],
      currentProjectPath: null,
      projectTitle: 'Untitled',
      isDirty: false,
      soundFontName: null,
    })

    audioEngine.setLooping(true)
    audioEngine.setMasterVolume(1.0)
    audioEngine.setListenerY(0)
  }, [])

  return { saveProject, openProject, newProject }
}
