import { useCallback, useEffect } from 'react'
import { Viewport } from './components/Viewport'
import { ControlPanel } from './components/ControlPanel'
import { TimelinePanel } from './components/TimelinePanel'
import { ToastProvider } from './components/Toast'
import { useToast } from './components/ToastContext'
import { useAppStore } from './stores/useAppStore'
import { DEFAULT_MAX_SOURCES } from './types'
import { audioEngine } from './audio/WebAudioEngine'
import { useProjectIO } from './hooks/useProjectIO'
import { VideoPanel } from './components/VideoPanel'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { usePluginStore } from './plugins/usePluginStore'

export default function App() {
  const { saveProject, openProject, loadProjectFile } = useProjectIO()
  const { showToast } = useToast()

  // Handle auto-opening project from command line / file association
  useEffect(() => {
    if (!window.api?.onInitialProject) return
    const cleanup = window.api.onInitialProject((path) => {
      loadProjectFile(path).catch(err => {
        console.error('Failed to auto-open project:', err)
        showToast('Failed to open initial project', 'error')
      })
    })
    return cleanup
  }, [loadProjectFile, showToast])

  // Scan plugins at startup so they're available for project deserialization
  useEffect(() => {
    if (!window.api?.scanPlugins) return
    const store = usePluginStore.getState()
    store.setIsScanning(true)
    window.api.scanPlugins()
      .then((manifests) => store.setAvailablePlugins(manifests))
      .catch(() => {})
      .finally(() => store.setIsScanning(false))
  }, [])

  // Probe for Demucs availability at startup
  useEffect(() => {
    if (!window.api?.demucsProbe) return
    window.api.demucsProbe()
      .then((probe) => useAppStore.getState().setDemucsProbe(probe))
      .catch(() => {})
  }, [])

  // Initialize keyboard shortcuts
  useKeyboardShortcuts(saveProject, openProject)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()

    const files = Array.from(e.dataTransfer.files)
    if (files.length === 0) return

    const { addSource, setSourceAudioFileName, setSourceAudioFilePath } = useAppStore.getState()

    for (const file of files) {
      const isAudio = /\.(wav|mp3|ogg|flac)$/i.test(file.name)
      const isMidi = /\.mid$/i.test(file.name)

      if (isAudio || isMidi) {
        if (useAppStore.getState().sources.length >= DEFAULT_MAX_SOURCES) {
          showToast(`Maximum ${DEFAULT_MAX_SOURCES} sources reached`, 'error')
          break
        }

        try {
          const buffer = await file.arrayBuffer()
          addSource(isMidi ? 'midi-track' : 'file')

          const newSource = useAppStore.getState().sources[useAppStore.getState().sources.length - 1]
          
          if (isAudio) {
            await audioEngine.loadFile(newSource.id, buffer)
            setSourceAudioFileName(newSource.id, file.name)
            if ((file as File & { path?: string }).path) setSourceAudioFilePath(newSource.id, (file as File & { path?: string }).path!)
            showToast(`Added audio: ${file.name}`, 'success')
          } else {
            await audioEngine.loadFile(newSource.id, buffer)
            setSourceAudioFileName(newSource.id, file.name)
            showToast(`Added MIDI: ${file.name}`, 'success')
          }
        } catch {
          showToast(`Failed to load ${file.name}`, 'error')
        }
      }
    }
  }, [showToast])

  return (
    <ToastProvider>
      <div 
        style={{ display: 'flex', width: '100vw', height: '100vh' }}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* Left: Viewport + Timeline stacked */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ flex: 1, background: '#08090d', minHeight: 0 }}>
            <Viewport />
          </div>
          <VideoPanel />
          <TimelinePanel />
        </div>

        {/* Right: Control Panel sidebar */}
        <div
          className="panel"
          style={{
            width: 300,
            padding: '12px 12px',
            overflowY: 'auto',
            overflowX: 'hidden',
            flexShrink: 0,
          }}
        >
          <ControlPanel />
        </div>
      </div>
    </ToastProvider>
  )
}
