import { useEffect } from 'react'
import { useAppStore } from '../stores/useAppStore'
import { useTransportStore } from '../stores/useTransportStore'
import { audioEngine } from '../audio/WebAudioEngine'
import { deleteTrack } from '../audio/midiTrackCache'
import { useToast } from '../components/Toast'

export function useKeyboardShortcuts(saveProject: (saveAs?: boolean) => void, openProject: () => void) {
  const { showToast } = useToast()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      const isMod = e.ctrlKey || e.metaKey

      // Ctrl+Z: Undo
      if (isMod && !e.shiftKey && e.key === 'z') {
        e.preventDefault()
        const { undoStack, undo } = useAppStore.getState()
        if (undoStack.length > 0) {
          const label = undoStack[undoStack.length - 1].label
          undo()
          showToast(`Undone: ${label}`, 'info')
        }
        return
      }

      // Ctrl+Y or Ctrl+Shift+Z: Redo
      if ((isMod && e.key === 'y') || (isMod && e.shiftKey && e.key === 'z')) {
        e.preventDefault()
        const { redoStack, redo } = useAppStore.getState()
        if (redoStack.length > 0) {
          const label = redoStack[redoStack.length - 1].label
          redo()
          showToast(`Redone: ${label}`, 'info')
        }
        return
      }

      // Ctrl+S: save
      if (isMod && e.key === 's') {
        e.preventDefault()
        saveProject(e.shiftKey)
        return
      }

      // Ctrl+O: open
      if (isMod && e.key === 'o') {
        e.preventDefault()
        openProject()
        return
      }

      const { sources, selectSource, removeSource, selectedSourceId, isRecordingKeyframes, setIsRecordingKeyframes } = useAppStore.getState()
      const transport = useTransportStore.getState()

      // R: toggle recording
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault()
        setIsRecordingKeyframes(!isRecordingKeyframes)
        return
      }

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

      // 1-8: select source
      const num = parseInt(e.key)
      if (num >= 1 && num <= 8 && num <= sources.length) {
        e.preventDefault()
        selectSource(sources[num - 1].id)
        return
      }

      // Delete/Backspace: remove source
      if ((e.code === 'Delete' || e.code === 'Backspace') && selectedSourceId) {
        e.preventDefault()
        if (sources.length > 1) {
          const source = sources.find((s) => s.id === selectedSourceId)
          const name = source?.label ?? 'this source'
          if (window.api?.showConfirmDialog) {
            window.api.showConfirmDialog({
              message: `Remove "${name}"?`,
              detail: 'This will remove the source and its audio from the session.',
              buttons: ['Remove', 'Cancel'],
              defaultId: 0,
              cancelId: 1,
            }).then((response) => {
              if (response === 0) {
                audioEngine.removeChannel(selectedSourceId)
                deleteTrack(selectedSourceId)
                removeSource(selectedSourceId)
              }
            })
          } else {
            audioEngine.removeChannel(selectedSourceId)
            deleteTrack(selectedSourceId)
            removeSource(selectedSourceId)
          }
        }
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [saveProject, openProject, showToast])
}
