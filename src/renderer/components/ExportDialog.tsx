import { useState } from 'react'
import { useAppStore } from '../stores/useAppStore'
import { audioEngine } from '../audio/WebAudioEngine'
import type { RenderSource } from '../audio/Exporter'
import {
  exportMixedBinauralWav,
  export51Wav,
} from '../audio/Exporter'
import { usePluginStore } from '../plugins/usePluginStore'
import { ExporterPlugin } from '../plugins/types'

interface ExportDialogProps {
  isOpen: boolean
  onClose: () => void
}

type ExportMode = 'binaural-stems' | 'binaural-mix' | '5.1-surround' | string

export function ExportDialog({ isOpen, onClose }: ExportDialogProps) {
  const [mode, setMode] = useState<ExportMode>('binaural-mix')
  const [isExporting, setIsExporting] = useState(false)
  const projectTitle = useAppStore((s) => s.projectTitle)
  const exporterPlugins = usePluginStore((s) => s.getExporterPlugins())

  if (!isOpen) return null

  const handleExport = async () => {
    if (!window.api) return
    setIsExporting(true)

    try {
      let buffer: ArrayBuffer | null = null
      let extension = 'wav'

      // Check if it's a plugin exporter
      const pluginInstance = exporterPlugins.find(p => p.manifest.id === mode)
      
      if (pluginInstance) {
        const plugin = pluginInstance.plugin as ExporterPlugin
        buffer = await plugin.export()
        extension = 'bin'
      } else {
        const appState = useAppStore.getState()
        const exportSources: RenderSource[] = appState.sources
          .filter((s) => {
            if (s.isMuted) return false
            const anySoloed = appState.sources.some((x) => x.isSoloed)
            if (anySoloed && !s.isSoloed) return false
            return audioEngine.getAudioBuffer(s.id) !== null
          })
          .map((s) => ({
            sourceId: s.id,
            audioBuffer: audioEngine.getAudioBuffer(s.id)!,
            position: s.position,
            volume: s.volume,
          }))

        switch (mode) {
          case 'binaural-stems':
          case 'binaural-mix':
            buffer = await exportMixedBinauralWav(exportSources, appState.listenerY, appState.animations)
            break
          case '5.1-surround':
            buffer = await export51Wav(exportSources, appState.listenerY, appState.animations)
            break
        }
      }

      if (buffer) {
        const defaultPath = `${projectTitle}.${extension}`
        const result = await window.api.saveWavFile(buffer, defaultPath)
        if (result.saved) {
          onClose()
        }
      }
    } catch (err) {
      console.error('Export failed:', err)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="export-overlay">
      <div className="export-dialog">
        <h3 className="section-label" style={{ marginBottom: 20 }}>Export Audio</h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 30 }}>
          <label className="radio-label">
            <input 
              type="radio" 
              checked={mode === 'binaural-mix'} 
              onChange={() => setMode('binaural-mix')} 
            />
            Binaural Mix (Stereo WAV)
          </label>
          <label className="radio-label">
            <input 
              type="radio" 
              checked={mode === '5.1-surround'} 
              onChange={() => setMode('5.1-surround')} 
            />
            5.1 Surround (6-channel WAV)
          </label>

          {exporterPlugins.length > 0 && (
            <>
              <div className="divider" style={{ margin: '8px 0' }} />
              <span className="section-label" style={{ fontSize: 9 }}>Plugin Formats</span>
              {exporterPlugins.map(p => (
                <label key={p.manifest.id} className="radio-label">
                  <input 
                    type="radio" 
                    checked={mode === p.manifest.id} 
                    onChange={() => setMode(p.manifest.id)} 
                  />
                  {p.manifest.name}
                </label>
              ))}
            </>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn" onClick={onClose} disabled={isExporting}>Cancel</button>
          <button 
            className="btn btn--accent" 
            onClick={handleExport} 
            disabled={isExporting}
          >
            {isExporting ? 'Exporting...' : 'Export'}
          </button>
        </div>
      </div>
    </div>
  )
}
