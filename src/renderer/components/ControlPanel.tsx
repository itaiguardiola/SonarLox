import { useState, useEffect } from 'react'
import { useAppStore } from '../stores/useAppStore'
import { useTransportStore } from '../stores/useTransportStore'
import { audioEngine } from '../audio/WebAudioEngine'
import {
  loadSoundFont,
  unloadSoundFont,
  renderMidiTrackWithSoundFont,
} from '../audio/SoundFontPlayer'
import { renderMidiTrack } from '../audio/MidiSynth'
import { getTrack } from '../audio/midiTrackCache'
import { SourceList } from './SourceList'
import { ExportDialog } from './ExportDialog'

export function ControlPanel() {
  const isPlaying = useTransportStore((s) => s.isPlaying)
  const isPaused = useTransportStore((s) => s.isPaused)
  const isLooping = useTransportStore((s) => s.isLooping)
  const play = useTransportStore((s) => s.play)
  const pause = useTransportStore((s) => s.pause)
  const stop = useTransportStore((s) => s.stop)
  const toggleLoop = useTransportStore((s) => s.toggleLoop)

  const listenerY = useAppStore((s) => s.listenerY)
  const setListenerY = useAppStore((s) => s.setListenerY)
  const cameraPresets = useAppStore((s) => s.cameraPresets)
  const setCameraCommand = useAppStore((s) => s.setCameraCommand)

  const masterVolume = useAppStore((s) => s.masterVolume)
  const setMasterVolume = useAppStore((s) => s.setMasterVolume)
  const selectedOutputDevice = useAppStore((s) => s.selectedOutputDevice)
  const setSelectedOutputDevice = useAppStore((s) => s.setSelectedOutputDevice)

  const soundFontName = useAppStore((s) => s.soundFontName)
  const setSoundFontName = useAppStore((s) => s.setSoundFontName)

  const selectedSourceId = useAppStore((s) => s.selectedSourceId)
  const selectedSource = useAppStore((s) =>
    s.sources.find((src) => src.id === s.selectedSourceId)
  )
  const setSourceVolume = useAppStore((s) => s.setSourceVolume)
  const setSourceAudioFileName = useAppStore((s) => s.setSourceAudioFileName)
  const setSourceSineFrequency = useAppStore((s) => s.setSourceSineFrequency)

  const isExporting = useAppStore((s) => s.isExporting)
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [outputDevices, setOutputDevices] = useState<MediaDeviceInfo[]>([])

  // Enumerate audio output devices
  useEffect(() => {
    const loadDevices = async () => {
      try {
        const devices = await audioEngine.enumerateDevices()
        setOutputDevices(devices)
      } catch {
        // Device enumeration not supported
      }
    }
    loadDevices()

    const handleChange = () => { loadDevices() }
    navigator.mediaDevices?.addEventListener('devicechange', handleChange)
    return () => {
      navigator.mediaDevices?.removeEventListener('devicechange', handleChange)
    }
  }, [])

  const handleDeviceChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const deviceId = e.target.value
    setSelectedOutputDevice(deviceId || null)
    if (deviceId) {
      try {
        await audioEngine.setOutputDevice(deviceId)
      } catch (err) {
        console.error('Failed to set output device:', err)
      }
    }
  }

  const [isLoadingSF, setIsLoadingSF] = useState(false)

  const reRenderMidiTracks = async (useSoundFont: boolean) => {
    const sources = useAppStore.getState().sources
    const midiSources = sources.filter((s) => s.sourceType === 'midi-track')
    for (const source of midiSources) {
      const trackData = getTrack(source.id)
      if (!trackData) continue
      const buffer = useSoundFont
        ? await renderMidiTrackWithSoundFont(trackData)
        : await renderMidiTrack(trackData)
      audioEngine.setAudioBuffer(source.id, buffer)
    }
  }

  const handleLoadSoundFont = async () => {
    if (!window.api) return
    try {
      const result = await window.api.openSoundFontFile()
      if (!result) return
      setIsLoadingSF(true)
      await loadSoundFont(result.buffer, result.name ?? 'soundfont.sf2')
      setSoundFontName(result.name ?? 'soundfont.sf2')
      await reRenderMidiTracks(true)
    } catch (err) {
      console.error('Failed to load SoundFont:', err)
    } finally {
      setIsLoadingSF(false)
    }
  }

  const handleUnloadSoundFont = async () => {
    unloadSoundFont()
    setSoundFontName(null)
    setIsLoadingSF(true)
    try {
      await reRenderMidiTracks(false)
    } finally {
      setIsLoadingSF(false)
    }
  }

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

  const handlePlay = () => { play() }
  const handlePause = () => { pause() }
  const handleStop = () => { stop() }

  const handleTestTone = async (type: 'sine' | 'pink-noise') => {
    if (!selectedSourceId) return
    await audioEngine.playTestTone(selectedSourceId, type)
    useAppStore.getState().setIsPlaying(true)
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

  const handleMasterVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value)
    setMasterVolume(v)
  }

  const sineFrequency = selectedSource?.sineFrequency ?? 440
  const isFileSource = selectedSource?.sourceType === 'file'
  const isToneSource = selectedSource?.sourceType === 'tone'
  const isMidiSource = selectedSource?.sourceType === 'midi-track'
  const isSineActive = isToneSource && (selectedSource?.audioFileName?.startsWith('Sine') ?? false)
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

      {/* Output Device & Master Volume */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span className="section-label">Output</span>
        {outputDevices.length > 0 && (
          <select
            value={selectedOutputDevice ?? ''}
            onChange={handleDeviceChange}
            style={{
              background: 'var(--bg-elevated)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 4,
              padding: '4px 6px',
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
            }}
          >
            <option value="">Default Device</option>
            {outputDevices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Device ${d.deviceId.slice(0, 8)}`}
              </option>
            ))}
          </select>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Master Volume</span>
          <span className="slider-value">{Math.round(masterVolume * 100)}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={masterVolume}
          onChange={handleMasterVolumeChange}
        />
      </div>

      <div className="divider" />

      {/* SoundFont */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span className="section-label">SoundFont</span>
        {soundFontName ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              flex: 1,
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--text-secondary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {soundFontName}
            </span>
            <button
              className="btn-icon"
              onClick={handleUnloadSoundFont}
              disabled={isLoadingSF}
              title="Unload SoundFont"
            >
              x
            </button>
          </div>
        ) : (
          <button
            className="btn"
            onClick={handleLoadSoundFont}
            disabled={isLoadingSF}
            style={{ fontSize: 11 }}
          >
            {isLoadingSF ? 'Loading...' : 'Load SF2'}
          </button>
        )}
        {isLoadingSF && (
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--text-muted)',
          }}>
            Rendering MIDI tracks...
          </span>
        )}
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
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                color: 'var(--text-muted)',
                marginLeft: 'auto',
              }}>
                {isFileSource ? 'FILE' : isToneSource ? 'TONE' : 'MIDI'}
              </span>
            </div>

            {/* File source: Load Audio */}
            {isFileSource && (
              <>
                <button className="btn" onClick={handleLoadAudio} style={{ flex: 1 }}>
                  Load Audio
                </button>
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
              </>
            )}

            {/* MIDI source: read-only info */}
            {isMidiSource && selectedSource.audioFileName && (
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: 'var(--text-secondary)',
              }}>
                {selectedSource.audioFileName}
              </span>
            )}

            {/* Tone source: Sine / Pink Noise */}
            {isToneSource && (
              <>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn" onClick={() => handleTestTone('sine')} style={{ flex: 1 }}>
                    Sine
                  </button>
                  <button className="btn" onClick={() => handleTestTone('pink-noise')} style={{ flex: 1 }}>
                    Pink Noise
                  </button>
                </div>
                {selectedSource.audioFileName && (
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    color: 'var(--text-secondary)',
                  }}>
                    {selectedSource.audioFileName}
                  </span>
                )}
                {isSineActive && (
                  <>
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
                  </>
                )}
              </>
            )}
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
            disabled={!isPlaying && !isPaused}
          >
            Stop
          </button>
        </div>
        <button
          className={`btn ${isLooping ? 'btn--active' : ''}`}
          onClick={toggleLoop}
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
          onClick={() => setShowExportDialog(true)}
          disabled={!hasAnyAudio || isExporting}
          style={{ flex: 'none' }}
        >
          {isExporting ? 'Exporting...' : 'Export...'}
        </button>
      </div>
      <ExportDialog
        isOpen={showExportDialog}
        onClose={() => setShowExportDialog(false)}
      />

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
