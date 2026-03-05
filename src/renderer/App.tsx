import { useEffect } from 'react'
import { Viewport } from './components/Viewport'
import { ControlPanel } from './components/ControlPanel'
import { TimelinePanel } from './components/TimelinePanel'
import { useAppStore } from './stores/useAppStore'
import { useTransportStore } from './stores/useTransportStore'
import { audioEngine } from './audio/WebAudioEngine'
import { useProjectIO } from './hooks/useProjectIO'

export default function App() {
  const { saveProject, openProject } = useProjectIO()

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      // Ctrl+S: save project
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        if (e.shiftKey) {
          saveProject(true) // save as
        } else {
          saveProject()
        }
        return
      }

      // Ctrl+O: open project
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault()
        openProject()
        return
      }

      const { sources, selectSource, removeSource, selectedSourceId } = useAppStore.getState()
      const transport = useTransportStore.getState()

      // Space: toggle play/pause
      if (e.code === 'Space') {
        e.preventDefault()
        if (transport.isPlaying) {
          transport.pause()
        } else if (audioEngine.hasAnyBuffer()) {
          transport.play()
        }
        return
      }

      // 1-8: select source by index
      const num = parseInt(e.key)
      if (num >= 1 && num <= 8 && num <= sources.length) {
        e.preventDefault()
        selectSource(sources[num - 1].id)
        return
      }

      // Delete/Backspace: remove selected source
      if ((e.code === 'Delete' || e.code === 'Backspace') && selectedSourceId) {
        e.preventDefault()
        if (sources.length > 1) {
          audioEngine.removeChannel(selectedSourceId)
          removeSource(selectedSourceId)
        }
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [saveProject, openProject])

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh' }}>
      {/* Left: Viewport + Timeline stacked */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ flex: 1, background: '#08090d', minHeight: 0 }}>
          <Viewport />
        </div>
        <TimelinePanel />
      </div>

      {/* Right: Control Panel sidebar */}
      <div
        className="panel"
        style={{
          width: 320,
          padding: '16px 14px',
          overflowY: 'auto',
          overflowX: 'hidden',
          flexShrink: 0,
        }}
      >
        <ControlPanel />
      </div>
    </div>
  )
}
