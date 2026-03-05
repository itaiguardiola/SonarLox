import { useAppStore } from '../../stores/useAppStore'
import { useTransportStore } from '../../stores/useTransportStore'
import { audioEngine } from '../../audio/WebAudioEngine'
import { useToast } from '../Toast'

export function SourcePropertiesSection() {
  const { showToast } = useToast()
  const isPlaying = useTransportStore((s) => s.isPlaying)
  const selectedSourceId = useAppStore((s) => s.selectedSourceId)
  const selectedSource = useAppStore((s) => s.sources.find((src) => src.id === s.selectedSourceId))
  const setSourceVolume = useAppStore((s) => s.setSourceVolume)
  const setSourceAudioFileName = useAppStore((s) => s.setSourceAudioFileName)
  const setSourceSineFrequency = useAppStore((s) => s.setSourceSineFrequency)

  if (!selectedSource) return null

  const isFileSource = selectedSource.sourceType === 'file'
  const isToneSource = selectedSource.sourceType === 'tone'
  const isMidiSource = selectedSource.sourceType === 'midi-track'
  const isSineActive = isToneSource && (selectedSource.audioFileName?.startsWith('Sine') ?? false)

  const handleLoadAudio = async () => {
    if (!selectedSourceId || !window.api) return
    try {
      const result = await window.api.openAudioFile()
      if (!result) return
      await audioEngine.loadFile(selectedSourceId, result.buffer)
      setSourceAudioFileName(selectedSourceId, result.name ?? 'audio file')
    } catch { showToast('Failed to load audio file', 'error') }
  }

  const handleTestTone = async (type: 'sine' | 'pink-noise') => {
    if (!selectedSourceId) return
    await audioEngine.playTestTone(selectedSourceId, type)
    useAppStore.getState().setIsPlaying(true)
    const freq = selectedSource.sineFrequency ?? 440
    setSourceAudioFileName(selectedSourceId, type === 'sine' ? `Sine ${Math.round(freq)} Hz` : 'Pink Noise')
  }

  const freqFromSlider = (v: number) => 20 * Math.pow(200, v)
  const sliderFromFreq = (f: number) => Math.log(f / 20) / Math.log(200)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: selectedSource.color }} />
        <span className="cp-section-label">{selectedSource.label}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', marginLeft: 'auto' }}>
          {selectedSource.sourceType.toUpperCase().replace('-TRACK', '')}
        </span>
      </div>

      {isFileSource && (
        <>
          <button className="btn" onClick={handleLoadAudio}>Load Audio</button>
          {selectedSource.audioFileName && <span className="readout-small">{selectedSource.audioFileName}</span>}
        </>
      )}

      {isToneSource && (
        <>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn" onClick={() => handleTestTone('sine')} style={{ flex: 1 }}>Sine</button>
            <button className="btn" onClick={() => handleTestTone('pink-noise')} style={{ flex: 1 }}>Pink Noise</button>
          </div>
          {isSineActive && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Frequency</span>
                <span className="slider-value">{Math.round(selectedSource.sineFrequency)} Hz</span>
              </div>
              <input
                type="range" min={0} max={1} step={0.001}
                value={sliderFromFreq(selectedSource.sineFrequency)}
                onChange={(e) => {
                  const freq = Math.round(freqFromSlider(parseFloat(e.target.value)))
                  setSourceSineFrequency(selectedSource.id, freq)
                  audioEngine.setSineFrequency(selectedSource.id, freq)
                }}
              />
            </>
          )}
        </>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="cp-section-label">Volume</span>
          <span className="slider-value">{Math.round(selectedSource.volume * 100)}%</span>
        </div>
        <input
          type="range" min={0} max={1} step={0.01}
          value={selectedSource.volume}
          onChange={(e) => setSourceVolume(selectedSource.id, parseFloat(e.target.value))}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span className="cp-section-label">Position</span>
        <div className="readout">
          <span style={{ color: 'var(--accent-red)', opacity: 0.7 }}>X</span> {selectedSource.position[0].toFixed(2)}
          <span style={{ color: 'var(--accent-teal)', opacity: 0.7, marginLeft: 8 }}>Y</span> {selectedSource.position[1].toFixed(2)}
          <span style={{ color: 'var(--accent-amber)', opacity: 0.7, marginLeft: 8 }}>Z</span> {selectedSource.position[2].toFixed(2)}
        </div>
      </div>
    </div>
  )
}
