import { useCallback } from 'react'
import { useAppStore } from '../stores/useAppStore'
import { useTransportStore } from '../stores/useTransportStore'
import { audioEngine } from '../audio/WebAudioEngine'
import { useToast } from '../components/ToastContext'
import { DEFAULT_MAX_SOURCES } from '../types'
import type { AudioSource } from '../types'

const STEM_COUNT = 4

export function useDemucsSeparate() {
  const { showToast } = useToast()

  const separate = useCallback(async (sourceId: string) => {
    const state = useAppStore.getState()
    const source = state.sources.find((s) => s.id === sourceId)
    if (!source?.audioFilePath) {
      showToast('Source has no file path -- re-add the file and try again', 'error')
      return
    }

    const availableSlots = DEFAULT_MAX_SOURCES - state.sources.length
    if (availableSlots < STEM_COUNT) {
      showToast(`Need ${STEM_COUNT} free slots but only ${availableSlots} available`, 'error')
      return
    }

    const probe = state.demucsProbe
    if (!probe?.available) {
      showToast('Demucs not available -- open setup first', 'error')
      return
    }

    // CPU warning
    if (probe.gpuType === 'cpu') {
      const response = await window.api.showConfirmDialog({
        message: 'Stem separation on CPU takes 3-5 minutes for a typical song.',
        detail: 'Run in background while you work?',
        buttons: ['Run in Background', 'Cancel'],
        defaultId: 0,
        cancelId: 1,
      })
      if (response !== 0) return
    }

    const { setDemucsStatus, setDemucsProgress, setDemucsError } = useAppStore.getState()
    setDemucsStatus('separating')
    setDemucsProgress(0)
    setDemucsError(null)

    const dispose = window.api.onDemucsProgress(({ percent }) => {
      useAppStore.getState().setDemucsProgress(percent)
    })

    try {
      const result = await window.api.demucsSeparate({
        inputFilePath: source.audioFilePath,
        model: 'htdemucs',
        device: probe.gpuType,
      })

      if (!result.success) {
        // OOM retry offer
        if (result.error?.includes('out of memory') && probe.gpuType !== 'cpu') {
          const retry = await window.api.showConfirmDialog({
            message: 'GPU out of memory.',
            detail: 'Retry on CPU? This will take longer.',
            buttons: ['Retry on CPU', 'Cancel'],
            defaultId: 0,
            cancelId: 1,
          })
          if (retry === 0) {
            dispose()
            setDemucsProgress(0)
            const dispose2 = window.api.onDemucsProgress(({ percent }) => {
              useAppStore.getState().setDemucsProgress(percent)
            })
            try {
              const retryResult = await window.api.demucsSeparate({
                inputFilePath: source.audioFilePath,
                model: 'htdemucs',
                device: 'cpu',
              })
              dispose2()
              if (retryResult.success) {
                await addStemsToSession(sourceId, retryResult.stems)
                setDemucsStatus('idle')
                showToast(`${retryResult.stems.length} stems added. Original source muted.`, 'success')
                return
              }
              setDemucsError(retryResult.error ?? 'Separation failed')
              setDemucsStatus('error')
              showToast(retryResult.error ?? 'Stem separation failed', 'error')
              return
            } catch (err) {
              dispose2()
              throw err
            }
          }
        }

        setDemucsError(result.error ?? 'Separation failed')
        setDemucsStatus('error')
        showToast(result.error ?? 'Stem separation failed', 'error')
        return
      }

      await addStemsToSession(sourceId, result.stems)
      setDemucsStatus('idle')
      showToast(`${result.stems.length} stems added. Original source muted.`, 'success')
    } catch (err) {
      setDemucsError(String(err))
      setDemucsStatus('error')
      showToast('Stem separation failed unexpectedly', 'error')
    } finally {
      dispose()
    }
  }, [showToast])

  return { separate }
}

interface StemData {
  name: string
  buffer: ArrayBuffer
  defaultPosition: [number, number, number]
  color: string
}

async function addStemsToSession(originalSourceId: string, stems: StemData[]) {
  const store = useAppStore.getState()

  // Record history once before the batch
  store.recordHistory('Spatialise stems')

  // Mute original
  store.setSourceMuted(originalSourceId, true)

  // Initialize audio engine
  await audioEngine.init()

  for (const stem of stems) {
    const newSource: AudioSource = {
      id: crypto.randomUUID(),
      label: stem.name.charAt(0).toUpperCase() + stem.name.slice(1),
      sourceType: 'file',
      position: stem.defaultPosition,
      volume: 1.0,
      color: stem.color,
      audioFileName: `${stem.name}.wav`,
      audioFilePath: null,
      sineFrequency: 440,
      isMuted: false,
      isSoloed: false,
    }

    useAppStore.getState().addSourceRaw(newSource)
    audioEngine.createChannel(newSource.id)
    await audioEngine.loadFile(newSource.id, stem.buffer)
  }

  useTransportStore.getState().refreshDuration()
}
