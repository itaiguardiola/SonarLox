import { useState, useEffect } from 'react'
import { useAppStore } from '../../stores/useAppStore'
import { audioEngine } from '../../audio/WebAudioEngine'
import { loadSoundFont, unloadSoundFont, renderMidiTrackWithSoundFont } from '../../audio/SoundFontPlayer'
import { renderMidiTrack } from '../../audio/MidiSynth'
import { getTrack } from '../../audio/midiTrackCache'
import { useToast } from '../Toast'

export function OutputSection() {
  const { showToast } = useToast()
  const masterVolume = useAppStore((s) => s.masterVolume)
  const setMasterVolume = useAppStore((s) => s.setMasterVolume)
  const selectedOutputDevice = useAppStore((s) => s.selectedOutputDevice)
  const setSelectedOutputDevice = useAppStore((s) => s.setSelectedOutputDevice)
  const soundFontName = useAppStore((s) => s.soundFontName)
  const setSoundFontName = useAppStore((s) => s.setSoundFontName)
  const hasMidiTracks = useAppStore((s) => s.sources.some((src) => src.sourceType === 'midi-track'))

  const [outputDevices, setOutputDevices] = useState<MediaDeviceInfo[]>([])
  const [isLoadingSF, setIsLoadingSF] = useState(false)

  useEffect(() => {
    const loadDevices = async () => {
      try {
        const devices = await audioEngine.enumerateDevices()
        setOutputDevices(devices)
      } catch { /* ignored */ }
    }
    loadDevices()
    const handleChange = () => { loadDevices() }
    navigator.mediaDevices?.addEventListener('devicechange', handleChange)
    return () => navigator.mediaDevices?.removeEventListener('devicechange', handleChange)
  }, [])

  const handleDeviceChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const deviceId = e.target.value
    setSelectedOutputDevice(deviceId || null)
    if (deviceId) {
      try {
        await audioEngine.setOutputDevice(deviceId)
      } catch {
        showToast('Failed to set output device', 'error')
      }
    }
  }

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
    } catch {
      showToast('Failed to load SoundFont', 'error')
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
          onChange={(e) => setMasterVolume(parseFloat(e.target.value))}
        />
      </div>

      {hasMidiTracks && (
        <>
          <div className="divider" />
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
                <button className="btn-icon" onClick={handleUnloadSoundFont} disabled={isLoadingSF}>x</button>
              </div>
            ) : (
              <button className="btn" onClick={handleLoadSoundFont} disabled={isLoadingSF} style={{ fontSize: 11 }}>
                {isLoadingSF ? 'Loading...' : 'Load SF2'}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
