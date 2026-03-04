import { useState } from 'react'
import { useAppStore } from '../stores/useAppStore'
import { audioEngine } from '../audio/AudioEngine'
import { exportBinauralWav, exportMixedBinauralWav } from '../audio/Exporter'
import { SourceList } from './SourceList'

export function ControlPanel() {
  const isPlaying = useAppStore((s) => s.isPlaying)
  const setIsPlaying = useAppStore((s) => s.setIsPlaying)
  const isLooping = useAppStore((s) => s.isLooping)
  const setIsLooping = useAppStore((s) => s.setIsLooping)
  const listenerY = useAppStore((s) => s.listenerY)
  const setListenerY = useAppStore((s) => s.setListenerY)
  const cameraPresets = useAppStore((s) => s.cameraPresets)
  const setCameraCommand = useAppStore((s) => s.setCameraCommand)

  const selectedSourceId = useAppStore((s) => s.selectedSourceId)
  const selectedSource = useAppStore((s) =>
    s.sources.find((src) => src.id === s.selectedSourceId)
  )
  const setSourceVolume = useAppStore((s) => s.setSourceVolume)
  const setSourceAudioFileName = useAppStore((s) => s.setSourceAudioFileName)
  const setSourceSineFrequency = useAppStore((s) => s.setSourceSineFrequency)

  const [isExporting, setIsExporting] = useState(false)

  const handleLoadAudio = async () => {
    if (!selectedSourceId) return
    try {
      if (!window.api) {
        console.error('window.api is not defined')
        return
      }
      const result = await window.api.openAudioFile()
      if (!result) return
      await audioEngine.loadFile(selectedSourceId, result.buffer)
      setSourceAudioFileName(selectedSourceId, result.name ?? 'audio file')
    } catch (err) {
      console.error('Failed to load audio:', err)
    }
  }

  const handlePlay = () => {
    audioEngine.playAll()
    setIsPlaying(true)
  }

  const handlePause = () => {
    audioEngine.pauseAll()
    setIsPlaying(false)
  }

  const handleStop = () => {
    audioEngine.stopAll()
    setIsPlaying(false)
  }

  const handleTestTone = async (type: 'sine' | 'pink-noise') => {
    if (!selectedSourceId) return
    await audioEngine.playTestTone(selectedSourceId, type)
    setIsPlaying(true)
    const freq = selectedSource?.sineFrequency ?? 440
    setSourceAudioFileName(
      selectedSourceId,
      type === 'sine' ? `Sine ${Math.round(freq)} Hz` : 'Pink Noise'
    )
  }

  const freqFromSlider = (v: number) => 20 * Math.pow(200, v)
  const sliderFromFreq = (f: number) => Math.log(f / 20) / Math.log(200)

  const handleFrequencyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedSourceId) return
    const freq = Math.round(freqFromSlider(parseFloat(e.target.value)))
    setSourceSineFrequency(selectedSourceId, freq)
    audioEngine.setSineFrequency(selectedSourceId, freq)
    if (isPlaying && selectedSource?.audioFileName?.startsWith('Sine')) {
      setSourceAudioFileName(selectedSourceId, `Sine ${freq} Hz`)
    }
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedSourceId) return
    const v = parseFloat(e.target.value)
    setSourceVolume(selectedSourceId, v)
  }

  const handleLoopToggle = () => {
    const next = !isLooping
    setIsLooping(next)
    audioEngine.setLooping(next)
  }

  const handleExportMix = async () => {
    const sources = useAppStore.getState().sources
    const exportSources = sources
      .filter((s) => !s.isMuted)
      .map((s) => {
        const buf = audioEngine.getAudioBuffer(s.id)
        return buf ? { audioBuffer: buf, position: s.position, volume: s.volume } : null
      })
      .filter((s): s is NonNullable<typeof s> => s !== null)

    if (exportSources.length === 0) return
    setIsExporting(true)
    try {
      const wav = await exportMixedBinauralWav(exportSources)
      await window.api.saveWavFile(wav)
    } catch (err) {
      console.error('Export failed:', err)
    } finally {
      setIsExporting(false)
    }
  }

  const handleExportPerSource = async () => {
    const sources = useAppStore.getState().sources
    setIsExporting(true)
    try {
      for (const source of sources) {
        if (source.isMuted) continue
        const buf = audioEngine.getAudioBuffer(source.id)
        if (!buf) continue
        const wav = await exportBinauralWav(buf, source.position, source.volume)
        const filename = `${source.label}${source.audioFileName ? ' - ' + source.audioFileName : ''}.wav`
        await window.api.saveWavFile(wav, filename)
      }
    } catch (err) {
      console.error('Export failed:', err)
    } finally {
      setIsExporting(false)
    }
  }

  const sineFrequency = selectedSource?.sineFrequency ?? 440
  const volume = selectedSource?.volume ?? 1
  const sourcePosition = selectedSource?.position ?? [0, 0, 0]
  const hasAnyAudio = audioEngine.hasAnyBuffer()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Brand */}
      <div style={{ paddingBottom: 2 }}>
        <h2 className="logo">
          Sonar<span className="logo-accent">Lox</span>
        </h2>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          color: 'var(--text-muted)',
          letterSpacing: '1px',
          marginTop: 2,
        }}>
          SPATIAL AUDIO EDITOR
        </div>
      </div>

      <div className="divider" />

      {/* Source List */}
      <SourceList />

      <div className="divider" />

      {/* Selected Source Controls */}
      {selectedSource && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: selectedSource.color,
                  boxShadow: `0 0 6px ${selectedSource.color}88`,
                }}
              />
              <span className="section-label" style={{ paddingBottom: 0 }}>
                {selectedSource.label}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn" onClick={handleLoadAudio} style={{ flex: 1 }}>
                Load Audio
              </button>
            </div>
            {selectedSource.audioFileName && (
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: 'var(--text-secondary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {selectedSource.audioFileName}
              </span>
            )}
          </div>

          {/* Test Tones */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span className="section-label">Test Tones</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn" onClick={() => handleTestTone('sine')} style={{ flex: 1 }}>
                Sine
              </button>
              <button className="btn" onClick={() => handleTestTone('pink-noise')} style={{ flex: 1 }}>
                Pink Noise
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Frequency</span>
              <span className="slider-value">{Math.round(sineFrequency)} Hz</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.001}
              value={sliderFromFreq(sineFrequency)}
              onChange={handleFrequencyChange}
            />
          </div>

          {/* Volume */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="section-label" style={{ paddingBottom: 0 }}>Volume</span>
              <span className="slider-value">{Math.round(volume * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={handleVolumeChange}
            />
          </div>

          {/* Position Readout */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="section-label">Position</span>
            <div className="readout">
              <span style={{ color: 'var(--accent-red)', opacity: 0.7 }}>X</span>{' '}
              {sourcePosition[0].toFixed(2)}{' '}
              <span style={{ color: 'var(--accent-teal)', opacity: 0.7, marginLeft: 8 }}>Y</span>{' '}
              {sourcePosition[1].toFixed(2)}{' '}
              <span style={{ color: 'var(--accent-amber)', opacity: 0.7, marginLeft: 8 }}>Z</span>{' '}
              {sourcePosition[2].toFixed(2)}
            </div>
          </div>

          <div className="divider" />
        </>
      )}

      {/* Transport */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span className="section-label">Transport</span>
        <div style={{ display: 'flex', gap: 5 }}>
          <button
            className={`btn btn--transport ${isPlaying ? '' : 'btn--accent'}`}
            onClick={handlePlay}
            disabled={!hasAnyAudio || isPlaying}
          >
            Play
          </button>
          <button
            className="btn btn--transport"
            onClick={handlePause}
            disabled={!isPlaying}
          >
            Pause
          </button>
          <button
            className="btn btn--transport btn--danger-subtle"
            onClick={handleStop}
            disabled={!isPlaying && !audioEngine.hasAnyPaused()}
          >
            Stop
          </button>
        </div>
        <button
          className={`btn ${isLooping ? 'btn--active' : ''}`}
          onClick={handleLoopToggle}
          style={{ fontSize: 11 }}
        >
          {isLooping ? 'Loop ON' : 'Loop OFF'}
        </button>
      </div>

      {/* Listener Height */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="section-label" style={{ paddingBottom: 0 }}>Listener Height</span>
          <span className="slider-value">{listenerY.toFixed(1)}</span>
        </div>
        <input
          type="range"
          min={0}
          max={10}
          step={0.1}
          value={listenerY}
          onChange={(e) => setListenerY(parseFloat(e.target.value))}
        />
      </div>

      <div className="divider" />

      {/* Export */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span className="section-label">Export</span>
        <button
          className="btn btn--accent"
          onClick={handleExportMix}
          disabled={!hasAnyAudio || isExporting}
          style={{ flex: 'none' }}
        >
          {isExporting ? 'Exporting...' : 'Export Mix'}
        </button>
        <button
          className="btn"
          onClick={handleExportPerSource}
          disabled={!hasAnyAudio || isExporting}
          style={{ flex: 'none' }}
        >
          Export Per-Source
        </button>
      </div>

      <div className="divider" />

      {/* Camera */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span className="section-label">Camera</span>
        <div style={{ display: 'flex', gap: 5 }}>
          <button className="btn" onClick={() => setCameraCommand({ type: 'home' })} style={{ flex: 1 }}>
            Home
          </button>
          {[0, 1, 2, 3].map((i) => (
            <button
              key={i}
              className={`btn preset-btn ${cameraPresets[i] ? 'preset-btn--filled btn--active' : ''}`}
              onClick={(e) => {
                if (e.shiftKey) {
                  setCameraCommand({ type: 'save', index: i })
                } else if (cameraPresets[i]) {
                  setCameraCommand({ type: 'recall', index: i })
                }
              }}
              style={{ minWidth: 34, flex: 'none', textAlign: 'center' }}
            >
              {i + 1}
            </button>
          ))}
        </div>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          color: 'var(--text-muted)',
          letterSpacing: '0.5px',
        }}>
          SHIFT+CLICK TO SAVE
        </span>
      </div>

      {/* Bottom spacer for scroll */}
      <div style={{ height: 8 }} />
    </div>
  )
}
