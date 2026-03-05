import { useAppStore } from '../../stores/useAppStore'
import { useTransportStore } from '../../stores/useTransportStore'
import { audioEngine } from '../../audio/WebAudioEngine'

export function TransportSection() {
  const isPlaying = useTransportStore((s) => s.isPlaying)
  const isPaused = useTransportStore((s) => s.isPaused)
  const isLooping = useTransportStore((s) => s.isLooping)
  const play = useTransportStore((s) => s.play)
  const pause = useTransportStore((s) => s.pause)
  const stop = useTransportStore((s) => s.stop)
  const toggleLoop = useTransportStore((s) => s.toggleLoop)

  const isRecordingKeyframes = useAppStore((s) => s.isRecordingKeyframes)
  const setIsRecordingKeyframes = useAppStore((s) => s.setIsRecordingKeyframes)
  const recordQuantize = useAppStore((s) => s.recordQuantize)
  const setRecordQuantize = useAppStore((s) => s.setRecordQuantize)

  // Subscribe to sources so we re-render when audio files are loaded
  const sources = useAppStore((s) => s.sources)
  const hasVideo = useAppStore((s) => s.videoFilePath !== null)
  const hasAnyAudio = sources.some((s) => s.audioFileName !== null) && audioEngine.hasAnyBuffer()
  const canPlay = hasAnyAudio || hasVideo

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span className="section-label">Transport</span>
      <div style={{ display: 'flex', gap: 5 }}>
        <button
          className={`btn btn--transport ${isPlaying ? '' : 'btn--accent'}`}
          onClick={() => play()}
          disabled={!canPlay || isPlaying}
        >
          Play
        </button>
        <button
          className="btn btn--transport"
          onClick={() => pause()}
          disabled={!isPlaying}
        >
          Pause
        </button>
        <button
          className="btn btn--transport btn--danger-subtle"
          onClick={() => stop()}
          disabled={!isPlaying && !isPaused}
        >
          Stop
        </button>
      </div>
      <div style={{ display: 'flex', gap: 5 }}>
        <button
          className={`btn ${isLooping ? 'btn--active' : ''}`}
          onClick={toggleLoop}
          style={{ fontSize: 11, flex: 1 }}
        >
          {isLooping ? 'Loop ON' : 'Loop OFF'}
        </button>
        <button
          className={`btn ${isRecordingKeyframes ? 'btn--record-active' : ''}`}
          onClick={() => setIsRecordingKeyframes(!isRecordingKeyframes)}
          style={{ fontSize: 11, flex: 1 }}
        >
          {isRecordingKeyframes ? 'Rec ON' : 'Rec'}
        </button>
      </div>
      {isRecordingKeyframes && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Quantize</span>
          <select
            value={recordQuantize}
            onChange={(e) => setRecordQuantize(parseFloat(e.target.value))}
            style={{
              background: 'var(--bg-elevated)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 4,
              padding: '2px 4px',
              fontSize: 10,
              fontFamily: 'var(--font-mono)',
            }}
          >
            <option value={0}>Off</option>
            <option value={0.05}>50ms</option>
            <option value={0.1}>100ms</option>
            <option value={0.25}>250ms</option>
            <option value={0.5}>500ms</option>
          </select>
        </div>
      )}
    </div>
  )
}
