import { useRef, useEffect, useCallback } from 'react'
import { useAppStore } from '../stores/useAppStore'
import { useTransportStore } from '../stores/useTransportStore'
import { audioEngine } from '../audio/WebAudioEngine'

const TIMELINE_HEIGHT = 150
const HEADER_WIDTH = 120
const ROW_HEIGHT = 32
const PLAYHEAD_COLOR = '#ff4444'

function downsampleBuffer(buffer: AudioBuffer, targetPoints: number): number[] {
  const data = buffer.getChannelData(0)
  const step = Math.max(1, Math.floor(data.length / targetPoints))
  const peaks: number[] = []
  for (let i = 0; i < targetPoints; i++) {
    const start = i * step
    const end = Math.min(start + step, data.length)
    let max = 0
    for (let j = start; j < end; j++) {
      const abs = Math.abs(data[j])
      if (abs > max) max = abs
    }
    peaks.push(max)
  }
  return peaks
}

interface WaveformRowProps {
  sourceId: string
  color: string
  duration: number
  totalDuration: number
  width: number
}

function WaveformRow({ sourceId, color, duration, totalDuration, width }: WaveformRowProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const buffer = audioEngine.getAudioBuffer(sourceId)
    if (!buffer) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const sourceWidth = totalDuration > 0 ? (duration / totalDuration) * width : width
    canvas.width = width
    canvas.height = ROW_HEIGHT

    ctx.clearRect(0, 0, width, ROW_HEIGHT)

    const targetPoints = Math.min(Math.floor(sourceWidth), 1000)
    if (targetPoints <= 0) return
    const peaks = downsampleBuffer(buffer, targetPoints)

    ctx.fillStyle = color + '66'
    const barWidth = sourceWidth / peaks.length

    for (let i = 0; i < peaks.length; i++) {
      const h = peaks[i] * (ROW_HEIGHT - 4)
      const x = i * barWidth
      const y = (ROW_HEIGHT - h) / 2
      ctx.fillRect(x, y, Math.max(1, barWidth - 0.5), h)
    }
  }, [sourceId, color, duration, totalDuration, width])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: ROW_HEIGHT, display: 'block' }}
    />
  )
}

export function TimelinePanel() {
  const sources = useAppStore((s) => s.sources)
  const setSourceMuted = useAppStore((s) => s.setSourceMuted)
  const setSourceSoloed = useAppStore((s) => s.setSourceSoloed)
  const playheadPosition = useTransportStore((s) => s.playheadPosition)
  const duration = useTransportStore((s) => s.duration)
  const seek = useTransportStore((s) => s.seek)

  const containerRef = useRef<HTMLDivElement>(null)
  const trackAreaRef = useRef<HTMLDivElement>(null)

  const getTrackWidth = useCallback(() => {
    if (!trackAreaRef.current) return 400
    return trackAreaRef.current.clientWidth
  }, [])

  const handleTimelineClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (duration <= 0) return
      const rect = e.currentTarget.getBoundingClientRect()
      const x = e.clientX - rect.left
      const fraction = Math.max(0, Math.min(1, x / rect.width))
      seek(fraction * duration)
    },
    [duration, seek]
  )

  const playheadFraction = duration > 0 ? playheadPosition / duration : 0

  return (
    <div
      ref={containerRef}
      className="panel"
      style={{
        height: TIMELINE_HEIGHT,
        borderTop: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '4px 8px',
          borderBottom: '1px solid var(--border-subtle)',
          fontSize: 10,
          color: 'var(--text-muted)',
          fontFamily: 'var(--font-mono)',
          gap: 8,
          flexShrink: 0,
        }}
      >
        <span>TIMELINE</span>
        <span style={{ marginLeft: 'auto' }}>
          {formatTime(playheadPosition)} / {formatTime(duration)}
        </span>
      </div>

      {/* Track rows */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        {sources.map((source) => {
          const buf = audioEngine.getAudioBuffer(source.id)
          const sourceDuration = buf?.duration ?? 0

          return (
            <div
              key={source.id}
              style={{
                display: 'flex',
                height: ROW_HEIGHT,
                borderBottom: '1px solid var(--border-subtle)',
                alignItems: 'center',
              }}
            >
              {/* Source label + controls */}
              <div
                style={{
                  width: HEADER_WIDTH,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '0 6px',
                  overflow: 'hidden',
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: source.color,
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontSize: 10,
                    color: 'var(--text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                  }}
                >
                  {source.label}
                </span>
                <button
                  className={`btn-icon ${source.isMuted ? 'btn-icon--muted' : ''}`}
                  onClick={() => setSourceMuted(source.id, !source.isMuted)}
                  style={{ fontSize: 9, width: 16, height: 16, padding: 0 }}
                  title={source.isMuted ? 'Unmute' : 'Mute'}
                >
                  M
                </button>
                <button
                  className={`btn-icon ${source.isSoloed ? 'btn-icon--soloed' : ''}`}
                  onClick={() => setSourceSoloed(source.id, !source.isSoloed)}
                  style={{ fontSize: 9, width: 16, height: 16, padding: 0 }}
                  title={source.isSoloed ? 'Unsolo' : 'Solo'}
                >
                  S
                </button>
              </div>

              {/* Waveform area */}
              <div
                ref={trackAreaRef}
                style={{
                  flex: 1,
                  height: '100%',
                  position: 'relative',
                  cursor: 'pointer',
                  background: 'var(--bg-surface)',
                }}
                onClick={handleTimelineClick}
              >
                {sourceDuration > 0 && (
                  <WaveformRow
                    sourceId={source.id}
                    color={source.color}
                    duration={sourceDuration}
                    totalDuration={duration}
                    width={getTrackWidth()}
                  />
                )}

                {/* Playhead line */}
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: `${playheadFraction * 100}%`,
                    width: 1,
                    background: PLAYHEAD_COLOR,
                    pointerEvents: 'none',
                    zIndex: 1,
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}
