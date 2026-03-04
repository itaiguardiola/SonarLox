import { useState } from 'react'
import { useAppStore } from '../stores/useAppStore'
import { audioEngine } from '../audio/AudioEngine'
import { exportBinauralWav } from '../audio/Exporter'

export function ControlPanel() {
  const sourcePosition = useAppStore((s) => s.sourcePosition)
  const isPlaying = useAppStore((s) => s.isPlaying)
  const audioFileName = useAppStore((s) => s.audioFileName)
  const setIsPlaying = useAppStore((s) => s.setIsPlaying)
  const volume = useAppStore((s) => s.volume)
  const setAudioFileName = useAppStore((s) => s.setAudioFileName)
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async () => {
    const buffer = audioEngine.getAudioBuffer()
    if (!buffer) return
    setIsExporting(true)
    try {
      const wav = await exportBinauralWav(buffer, sourcePosition, volume)
      await window.api.saveWavFile(wav)
    } catch (err) {
      console.error('Export failed:', err)
    } finally {
      setIsExporting(false)
    }
  }

  const handleLoadAudio = async () => {
    try {
      if (!window.api) {
        console.error('window.api is not defined — preload may not have run')
        return
      }
      const result = await window.api.openAudioFile()
      if (!result) return
      await audioEngine.loadFile(result.buffer)
      setAudioFileName(result.name ?? 'audio file')
    } catch (err) {
      console.error('Failed to load audio:', err)
    }
  }

  const handlePlay = () => {
    audioEngine.play()
    setIsPlaying(true)
  }

  const handleStop = () => {
    audioEngine.stop()
    setIsPlaying(false)
  }

  const handleTestTone = async (type: 'sine' | 'pink-noise') => {
    await audioEngine.playTestTone(type)
    setIsPlaying(true)
    setAudioFileName(type === 'sine' ? 'Sine 440 Hz' : 'Pink Noise')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h2 style={{ margin: 0, fontSize: 20 }}>SonarLox</h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <label style={{ fontSize: 11, opacity: 0.5, textTransform: 'uppercase' }}>Source</label>
        <button onClick={handleLoadAudio} style={btnStyle}>
          Load Audio
        </button>
        {audioFileName && (
          <span style={{ fontSize: 12, opacity: 0.7 }}>{audioFileName}</span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <label style={{ fontSize: 11, opacity: 0.5, textTransform: 'uppercase' }}>Test Tones</label>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => handleTestTone('sine')} style={btnStyle}>
            Sine
          </button>
          <button onClick={() => handleTestTone('pink-noise')} style={btnStyle}>
            Pink Noise
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <label style={{ fontSize: 11, opacity: 0.5, textTransform: 'uppercase' }}>Transport</label>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={handlePlay} disabled={!audioFileName || isPlaying} style={btnStyle}>
            Play
          </button>
          <button onClick={handleStop} disabled={!isPlaying} style={btnStyle}>
            Stop
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <label style={{ fontSize: 11, opacity: 0.5, textTransform: 'uppercase' }}>Export</label>
        <button
          onClick={handleExport}
          disabled={!audioFileName || isExporting}
          style={btnStyle}
        >
          {isExporting ? 'Exporting...' : 'Export WAV'}
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <label style={{ fontSize: 11, opacity: 0.5, textTransform: 'uppercase' }}>Position</label>
        <div style={{ fontFamily: 'monospace', fontSize: 13 }}>
          X: {sourcePosition[0].toFixed(2)}{' '}
          Y: {sourcePosition[1].toFixed(2)}{' '}
          Z: {sourcePosition[2].toFixed(2)}
        </div>
      </div>
    </div>
  )
}

const btnStyle: React.CSSProperties = {
  flex: 1,
  padding: '8px 12px',
  background: '#1a1a2e',
  border: '1px solid #444',
  borderRadius: 4,
  color: '#e0e0e0',
  cursor: 'pointer',
  fontSize: 13
}
