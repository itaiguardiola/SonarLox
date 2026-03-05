import { useState, useRef } from 'react'
import { useAppStore } from '../stores/useAppStore'
import { audioEngine } from '../audio/WebAudioEngine'
import {
  exportBinauralWav,
  exportMixedBinauralWav,
  export51Wav,
  export51WavSingle,
} from '../audio/Exporter'
import type { ExportSource } from '../audio/Exporter'
import { useToast } from './Toast'
import { usePluginStore } from '../plugins/usePluginStore'
import type { ExporterPlugin, ExporterSourceData } from '../plugins/types'

type ExportType = 'mix' | 'stems'
type RenderMode = 'binaural' | '5.1' | 'both' | `plugin:${string}`

interface ExportDialogProps {
  isOpen: boolean
  onClose: () => void
}

export function ExportDialog({ isOpen, onClose }: ExportDialogProps) {
  const { showToast } = useToast()
  const [exportType, setExportType] = useState<ExportType>('mix')
  const [renderMode, setRenderMode] = useState<RenderMode>('binaural')
  const [isCancelling, setIsCancelling] = useState(false)
  const cancelRef = useRef(false)

  const isExporting = useAppStore((s) => s.isExporting)
  const exportProgress = useAppStore((s) => s.exportProgress)

  // Get active exporter plugins
  const activePlugins = usePluginStore((s) => s.activePlugins)
  const exporterPlugins = Array.from(activePlugins.values()).filter(
    (p) => p.manifest.type === 'exporter' && p.enabled
  )

  if (!isOpen) return null

  function getExportableSources() {
    const { sources } = useAppStore.getState()
    const anySoloed = sources.some((s) => s.isSoloed)

    return sources.filter((s) => {
      if (s.isMuted) return false
      if (anySoloed && !s.isSoloed) return false
      return audioEngine.getAudioBuffer(s.id) !== null
    })
  }

  function buildExportSources(
    filteredSources: ReturnType<typeof getExportableSources>
  ): ExportSource[] {
    return filteredSources
      .map((s) => {
        const buf = audioEngine.getAudioBuffer(s.id)
        if (!buf) return null
        const src: ExportSource = { audioBuffer: buf, position: s.position, volume: s.volume, sourceId: s.id }
        return src
      })
      .filter((s): s is ExportSource => s !== null)
  }

  function sanitizeFilename(name: string): string {
    return name
      .replace(/[/\\:*?"<>|\x00]/g, '_')
      .replace(/^\.+/, '_')
      .replace(/^(CON|PRN|AUX|NUL|COM\d|LPT\d)$/i, '_$1')
      .trim()
      .slice(0, 200)
  }

  function stemFilename(
    label: string,
    audioFileName: string | null,
    suffix: string
  ): string {
    const base = sanitizeFilename(
      label + (audioFileName ? ' - ' + audioFileName : '')
    )
    return base + suffix
  }

  async function handleExport() {
    const { setIsExporting, setExportProgress, listenerY, animations } =
      useAppStore.getState()
    const filteredSources = getExportableSources()
    if (filteredSources.length === 0) return

    cancelRef.current = false
    setIsCancelling(false)
    setIsExporting(true)
    setExportProgress(0)

    try {
      if (renderMode.startsWith('plugin:')) {
        await exportWithPlugin(filteredSources, listenerY, setExportProgress)
      } else if (exportType === 'mix') {
        await exportMix(filteredSources, listenerY, setExportProgress, animations)
      } else {
        await exportStems(filteredSources, listenerY, setExportProgress, animations)
      }
    } catch {
      showToast('Export failed', 'error')
    } finally {
      setIsExporting(false)
      setExportProgress(0)
    }
  }

  async function exportMix(
    filteredSources: ReturnType<typeof getExportableSources>,
    listenerY: number,
    setProgress: (p: number) => void,
    animations: ReturnType<typeof useAppStore.getState>['animations'],
  ) {
    const exportSources = buildExportSources(filteredSources)
    if (exportSources.length === 0) return

    const jobs: Array<() => Promise<void>> = []

    if (renderMode === 'binaural' || renderMode === 'both') {
      jobs.push(async () => {
        const wav = await exportMixedBinauralWav(exportSources, listenerY, animations)
        await window.api.saveWavFile(wav, 'mix_binaural.wav')
      })
    }

    if (renderMode === '5.1' || renderMode === 'both') {
      jobs.push(async () => {
        const wav = await export51Wav(exportSources, listenerY, animations)
        await window.api.saveWavFile(wav, 'mix_51.wav')
      })
    }

    for (let i = 0; i < jobs.length; i++) {
      if (cancelRef.current) break
      await jobs[i]()
      setProgress((i + 1) / jobs.length)
    }
  }

  async function exportStems(
    filteredSources: ReturnType<typeof getExportableSources>,
    listenerY: number,
    setProgress: (p: number) => void,
    animations: ReturnType<typeof useAppStore.getState>['animations'],
  ) {
    const dir = await window.api.selectDirectory()
    if (!dir) {
      useAppStore.getState().setIsExporting(false)
      return
    }

    const jobsPerSource =
      renderMode === 'both' ? 2 : 1
    const totalJobs = filteredSources.length * jobsPerSource
    let completed = 0

    for (const source of filteredSources) {
      if (cancelRef.current) break
      const buf = audioEngine.getAudioBuffer(source.id)
      if (!buf) {
        completed += jobsPerSource
        setProgress(completed / totalJobs)
        continue
      }

      if (renderMode === 'binaural' || renderMode === 'both') {
        if (cancelRef.current) break
        const wav = await exportBinauralWav(
          buf,
          source.position,
          source.volume,
          listenerY,
          source.id,
          animations,
        )
        const filename = stemFilename(
          source.label,
          source.audioFileName,
          '.wav'
        )
        await window.api.saveWavFileToPath(wav, dir + '/' + filename, dir)
        completed++
        setProgress(completed / totalJobs)
      }

      if (renderMode === '5.1' || renderMode === 'both') {
        if (cancelRef.current) break
        const wav = await export51WavSingle(
          buf,
          source.position,
          source.volume,
          listenerY,
          source.id,
          animations,
        )
        const filename = stemFilename(
          source.label,
          source.audioFileName,
          '_51.wav'
        )
        await window.api.saveWavFileToPath(wav, dir + '/' + filename, dir)
        completed++
        setProgress(completed / totalJobs)
      }
    }
  }

  async function exportWithPlugin(
    filteredSources: ReturnType<typeof getExportableSources>,
    listenerY: number,
    setProgress: (p: number) => void,
  ) {
    const pluginId = renderMode.replace('plugin:', '')
    const instance = activePlugins.get(pluginId)
    if (!instance) return

    const exporter = instance.plugin as ExporterPlugin
    const sourceData: ExporterSourceData[] = filteredSources
      .map((s) => {
        const buf = audioEngine.getAudioBuffer(s.id)
        if (!buf) return null
        return { id: s.id, audioBuffer: buf, position: s.position, volume: s.volume, label: s.label }
      })
      .filter((s): s is ExporterSourceData => s !== null)

    if (sourceData.length === 0) return

    setProgress(0)
    const data = await exporter.export(sourceData, listenerY)
    setProgress(0.9)

    const ext = exporter.fileExtension ?? 'bin'
    await window.api.saveWavFile(data, `export.${ext}`)
    setProgress(1)
  }

  function handleCancel() {
    if (isExporting) {
      cancelRef.current = true
      setIsCancelling(true)
    } else {
      onClose()
    }
  }

  const sectionStyle = {
    display: 'flex' as const,
    flexDirection: 'column' as const,
    gap: 4,
  }

  return (
    <div className="export-overlay" onClick={(e) => { if (e.target === e.currentTarget && !isExporting) onClose() }}>
      <div className="export-dialog">
        <h3
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 16,
            fontWeight: 600,
            color: 'var(--text-bright)',
            letterSpacing: '1px',
            textTransform: 'uppercase',
            marginBottom: 16,
          }}
        >
          Export Audio
        </h3>

        {/* Export Type */}
        <div style={{ ...sectionStyle, marginBottom: 14 }}>
          <span className="section-label">Export Type</span>
          <div className="export-radio-group">
            <label className="export-radio-label">
              <input
                type="radio"
                name="exportType"
                checked={exportType === 'mix'}
                onChange={() => setExportType('mix')}
                disabled={isExporting}
              />
              Full Mix
            </label>
            <label className="export-radio-label">
              <input
                type="radio"
                name="exportType"
                checked={exportType === 'stems'}
                onChange={() => setExportType('stems')}
                disabled={isExporting}
              />
              Individual Stems
            </label>
          </div>
        </div>

        {/* Render Mode */}
        <div style={{ ...sectionStyle, marginBottom: 14 }}>
          <span className="section-label">Rendering Mode</span>
          <div className="export-radio-group">
            <label className="export-radio-label">
              <input
                type="radio"
                name="renderMode"
                checked={renderMode === 'binaural'}
                onChange={() => setRenderMode('binaural')}
                disabled={isExporting}
              />
              Binaural (Stereo)
            </label>
            <label className="export-radio-label">
              <input
                type="radio"
                name="renderMode"
                checked={renderMode === '5.1'}
                onChange={() => setRenderMode('5.1')}
                disabled={isExporting}
              />
              5.1 Surround
            </label>
            <label className="export-radio-label">
              <input
                type="radio"
                name="renderMode"
                checked={renderMode === 'both'}
                onChange={() => setRenderMode('both')}
                disabled={isExporting}
              />
              Both
            </label>
            {exporterPlugins.map((ep) => (
              <label key={ep.manifest.id} className="export-radio-label">
                <input
                  type="radio"
                  name="renderMode"
                  checked={renderMode === `plugin:${ep.manifest.id}`}
                  onChange={() => setRenderMode(`plugin:${ep.manifest.id}`)}
                  disabled={isExporting}
                />
                {(ep.plugin as ExporterPlugin).exportLabel ?? ep.manifest.name}
              </label>
            ))}
          </div>
        </div>

        {/* Progress */}
        {isExporting && (
          <div style={{ marginBottom: 14 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: 6,
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  color: 'var(--text-secondary)',
                }}
              >
                {isCancelling
                  ? 'Cancelling...'
                  : exportProgress > 0
                    ? `${Math.round(exportProgress * 100)}%`
                    : 'Rendering...'}
              </span>
            </div>
            <div className="export-progress-bar">
              <div
                className={`export-progress-fill${exportProgress === 0 ? ' export-progress-fill--indeterminate' : ''}`}
                style={{
                  width: exportProgress > 0 ? `${exportProgress * 100}%` : undefined,
                }}
              />
            </div>
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            className="btn"
            onClick={handleCancel}
          >
            {isExporting ? 'Cancel' : 'Close'}
          </button>
          <button
            className="btn btn--accent"
            onClick={handleExport}
            disabled={isExporting}
          >
            Export
          </button>
        </div>
      </div>
    </div>
  )
}
