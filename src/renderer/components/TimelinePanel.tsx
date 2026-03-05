import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { useAppStore } from '../stores/useAppStore'
import { useTransportStore } from '../stores/useTransportStore'
import { audioEngine } from '../audio/WebAudioEngine'
import type { SourceId, EasingType } from '../types'

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const MIN_HEIGHT = 120
const DEFAULT_HEIGHT = 180
const MAX_HEIGHT = 400
const HEADER_WIDTH = 140
const ROW_HEIGHT = 36
const LANE_HEIGHT = 28
const RULER_HEIGHT = 22
const PLAYHEAD_COLOR = '#e84057'
const PLAYHEAD_GLOW = 'rgba(232, 64, 87, 0.35)'

/* ------------------------------------------------------------------ */
/*  Time ruler tick helpers                                            */
/* ------------------------------------------------------------------ */

interface Tick {
  time: number
  x: number
  major: boolean
}

function computeTicks(duration: number, width: number): Tick[] {
  if (duration <= 0 || width <= 0) return []
  // Choose interval so major ticks are ~80-120px apart
  const pixelsPerSec = width / duration
  const rawInterval = 80 / pixelsPerSec
  const nice = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60]
  const interval = nice.find((n) => n >= rawInterval) ?? 60
  const majorEvery = interval < 1 ? 5 : interval < 5 ? 5 : 2

  const ticks: Tick[] = []
  let i = 0
  for (let t = 0; t <= duration + 0.001; t += interval, i++) {
    ticks.push({ time: t, x: (t / duration) * width, major: i % majorEvery === 0 })
  }
  return ticks
}

/* ------------------------------------------------------------------ */
/*  Waveform downsample                                               */
/* ------------------------------------------------------------------ */

function downsampleBuffer(buffer: AudioBuffer, targetPoints: number): Float32Array {
  const data = buffer.getChannelData(0)
  const step = Math.max(1, Math.floor(data.length / targetPoints))
  const peaks = new Float32Array(targetPoints)
  for (let i = 0; i < targetPoints; i++) {
    const start = i * step
    const end = Math.min(start + step, data.length)
    let max = 0
    for (let j = start; j < end; j++) {
      const abs = Math.abs(data[j])
      if (abs > max) max = abs
    }
    peaks[i] = max
  }
  return peaks
}

/* ------------------------------------------------------------------ */
/*  WaveformRow                                                       */
/* ------------------------------------------------------------------ */

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

    const dpr = window.devicePixelRatio || 1
    const sourceWidth = totalDuration > 0 ? (duration / totalDuration) * width : width
    canvas.width = width * dpr
    canvas.height = ROW_HEIGHT * dpr
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, width, ROW_HEIGHT)

    const targetPoints = Math.min(Math.floor(sourceWidth * 1.5), 1200)
    if (targetPoints <= 0) return
    const peaks = downsampleBuffer(buffer, targetPoints)
    const barWidth = sourceWidth / peaks.length
    const midY = ROW_HEIGHT / 2

    // Mirrored waveform with gradient fill
    const grad = ctx.createLinearGradient(0, 2, 0, ROW_HEIGHT - 2)
    grad.addColorStop(0, color + '10')
    grad.addColorStop(0.35, color + '50')
    grad.addColorStop(0.5, color + '70')
    grad.addColorStop(0.65, color + '50')
    grad.addColorStop(1, color + '10')

    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.moveTo(0, midY)
    for (let i = 0; i < peaks.length; i++) {
      const h = peaks[i] * (ROW_HEIGHT - 6) * 0.5
      ctx.lineTo(i * barWidth, midY - h)
    }
    ctx.lineTo(sourceWidth, midY)
    for (let i = peaks.length - 1; i >= 0; i--) {
      const h = peaks[i] * (ROW_HEIGHT - 6) * 0.5
      ctx.lineTo(i * barWidth, midY + h)
    }
    ctx.closePath()
    ctx.fill()

    // Center spine line
    ctx.strokeStyle = color + '30'
    ctx.lineWidth = 0.5
    ctx.beginPath()
    ctx.moveTo(0, midY)
    ctx.lineTo(sourceWidth, midY)
    ctx.stroke()
  }, [sourceId, color, duration, totalDuration, width])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: ROW_HEIGHT, display: 'block' }}
    />
  )
}

/* ------------------------------------------------------------------ */
/*  AutomationLane                                                    */
/* ------------------------------------------------------------------ */

interface AutomationLaneProps {
  sourceId: SourceId
  color: string
  totalDuration: number
  width: number
}

function AutomationLane({ sourceId, color, totalDuration, width }: AutomationLaneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const keyframes = useAppStore((s) => s.animations[sourceId]?.keyframes ?? [])
  const setKeyframe = useAppStore((s) => s.setKeyframe)
  const removeKeyframe = useAppStore((s) => s.removeKeyframe)

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; time: number } | null>(null)
  const [selectedEasing, setSelectedEasing] = useState<EasingType>('linear')

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = LANE_HEIGHT * dpr
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, width, LANE_HEIGHT)

    if (keyframes.length === 0 || totalDuration <= 0) return

    const timeToX = (t: number) => (t / totalDuration) * width
    const midY = LANE_HEIGHT / 2

    // Dashed connecting lines
    ctx.strokeStyle = color + '40'
    ctx.lineWidth = 1
    ctx.setLineDash([3, 3])
    ctx.beginPath()
    for (let i = 0; i < keyframes.length; i++) {
      const x = timeToX(keyframes[i].time)
      if (i === 0) ctx.moveTo(x, midY)
      else ctx.lineTo(x, midY)
    }
    ctx.stroke()
    ctx.setLineDash([])

    // Diamond markers with glow
    const size = 5
    for (const kf of keyframes) {
      const x = timeToX(kf.time)
      // Glow
      ctx.shadowColor = color
      ctx.shadowBlur = 6
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.moveTo(x, midY - size)
      ctx.lineTo(x + size, midY)
      ctx.lineTo(x, midY + size)
      ctx.lineTo(x - size, midY)
      ctx.closePath()
      ctx.fill()
      ctx.shadowBlur = 0

      // Inner highlight
      ctx.fillStyle = '#ffffff40'
      ctx.beginPath()
      ctx.moveTo(x, midY - size + 2)
      ctx.lineTo(x + size - 2, midY)
      ctx.lineTo(x, midY - 1)
      ctx.lineTo(x - size + 2, midY)
      ctx.closePath()
      ctx.fill()
    }
  }, [keyframes, color, totalDuration, width])

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (totalDuration <= 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const time = (x / rect.width) * totalDuration
    const timeToX = (t: number) => (t / totalDuration) * rect.width
    for (const kf of keyframes) {
      if (Math.abs(timeToX(kf.time) - x) < 6) return
    }
    const source = useAppStore.getState().sources.find((s) => s.id === sourceId)
    if (source) {
      setKeyframe(sourceId, time, source.position)
    }
  }, [sourceId, totalDuration, keyframes, setKeyframe])

  const handleContextMenu = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    if (totalDuration <= 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const timeToX = (t: number) => (t / totalDuration) * rect.width
    for (const kf of keyframes) {
      if (Math.abs(timeToX(kf.time) - x) < 8) {
        setContextMenu({ x: e.clientX, y: e.clientY, time: kf.time })
        setSelectedEasing(kf.easing)
        return
      }
    }
  }, [totalDuration, keyframes])

  const handleDeleteKeyframe = useCallback(() => {
    if (contextMenu) {
      removeKeyframe(sourceId, contextMenu.time)
      setContextMenu(null)
    }
  }, [sourceId, contextMenu, removeKeyframe])

  const handleEasingChange = useCallback((easing: EasingType) => {
    if (!contextMenu) return
    const kf = keyframes.find((k) => Math.abs(k.time - contextMenu.time) < 0.001)
    if (kf) {
      removeKeyframe(sourceId, kf.time)
      setKeyframe(sourceId, kf.time, kf.position, easing)
    }
    setSelectedEasing(easing)
    setContextMenu(null)
  }, [sourceId, contextMenu, keyframes, removeKeyframe, setKeyframe])

  return (
    <div className="tl-lane">
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: LANE_HEIGHT, display: 'block', cursor: 'crosshair' }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      />
      {contextMenu && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 999 }}
            onClick={() => setContextMenu(null)}
            onContextMenu={(e) => { e.preventDefault(); setContextMenu(null) }}
          />
          <div
            className="kf-context-menu"
            style={{ position: 'fixed', left: contextMenu.x, top: contextMenu.y, zIndex: 1000 }}
          >
            <button onClick={handleDeleteKeyframe}>Delete</button>
            <div className="kf-context-divider" />
            {(['linear', 'ease-in', 'ease-out', 'ease-in-out'] as EasingType[]).map((e) => (
              <button
                key={e}
                onClick={() => handleEasingChange(e)}
                style={{ fontWeight: e === selectedEasing ? 600 : 400 }}
              >
                {e === selectedEasing ? '> ' : '  '}{e}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  TimeRuler                                                         */
/* ------------------------------------------------------------------ */

interface TimeRulerProps {
  duration: number
  width: number
  playheadFraction: number
  onSeek: (e: React.MouseEvent<HTMLCanvasElement>) => void
}

function TimeRuler({ duration, width, playheadFraction, onSeek }: TimeRulerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = RULER_HEIGHT * dpr
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, width, RULER_HEIGHT)

    const ticks = computeTicks(duration, width)

    // Tick marks
    for (const tick of ticks) {
      ctx.strokeStyle = tick.major ? '#464d6480' : '#464d6430'
      ctx.lineWidth = tick.major ? 1 : 0.5
      ctx.beginPath()
      ctx.moveTo(tick.x, tick.major ? 0 : RULER_HEIGHT * 0.45)
      ctx.lineTo(tick.x, RULER_HEIGHT)
      ctx.stroke()

      if (tick.major) {
        ctx.fillStyle = '#464d64'
        ctx.font = '9px "Share Tech Mono", monospace'
        ctx.textAlign = 'center'
        ctx.fillText(formatTimeCompact(tick.time), tick.x, 10)
      }
    }

    // Playhead triangle marker
    const px = playheadFraction * width
    ctx.fillStyle = PLAYHEAD_COLOR
    ctx.beginPath()
    ctx.moveTo(px - 5, 0)
    ctx.lineTo(px + 5, 0)
    ctx.lineTo(px, 8)
    ctx.closePath()
    ctx.fill()
  }, [duration, width, playheadFraction])

  return (
    <canvas
      ref={canvasRef}
      onClick={onSeek}
      style={{
        width: '100%',
        height: RULER_HEIGHT,
        display: 'block',
        cursor: 'col-resize',
      }}
    />
  )
}

/* ------------------------------------------------------------------ */
/*  TimelinePanel                                                     */
/* ------------------------------------------------------------------ */

export function TimelinePanel() {
  const sources = useAppStore((s) => s.sources)
  const setSourceMuted = useAppStore((s) => s.setSourceMuted)
  const setSourceSoloed = useAppStore((s) => s.setSourceSoloed)
  const playheadPosition = useTransportStore((s) => s.playheadPosition)
  const duration = useTransportStore((s) => s.duration)
  const seek = useTransportStore((s) => s.seek)
  const animations = useAppStore((s) => s.animations)

  const [expandedLanes, setExpandedLanes] = useState<Set<SourceId>>(new Set())
  const toggleLane = useCallback((id: SourceId) => {
    setExpandedLanes((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // Resizable height
  const [panelHeight, setPanelHeight] = useState(DEFAULT_HEIGHT)
  const isDraggingResize = useRef(false)
  const dragStartY = useRef(0)
  const dragStartHeight = useRef(0)

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDraggingResize.current = true
    dragStartY.current = e.clientY
    dragStartHeight.current = panelHeight

    const onMove = (ev: MouseEvent) => {
      if (!isDraggingResize.current) return
      const delta = dragStartY.current - ev.clientY
      const next = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, dragStartHeight.current + delta))
      setPanelHeight(next)
    }
    const onUp = () => {
      isDraggingResize.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [panelHeight])

  const containerRef = useRef<HTMLDivElement>(null)
  const trackAreaRef = useRef<HTMLDivElement>(null)

  const getTrackWidth = useCallback(() => {
    if (!trackAreaRef.current) return 400
    return trackAreaRef.current.clientWidth
  }, [])

  const handleTimelineClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement | HTMLCanvasElement>) => {
      if (duration <= 0) return
      const rect = e.currentTarget.getBoundingClientRect()
      const x = e.clientX - rect.left
      const fraction = Math.max(0, Math.min(1, x / rect.width))
      seek(fraction * duration)
    },
    [duration, seek]
  )

  const playheadFraction = duration > 0 ? playheadPosition / duration : 0
  const trackWidth = getTrackWidth()

  // Memoize grid lines canvas data url for track backgrounds
  const gridBg = useMemo(() => {
    if (duration <= 0 || trackWidth <= 0) return 'none'
    const ticks = computeTicks(duration, trackWidth)
    const majorTicks = ticks.filter((t) => t.major)
    if (majorTicks.length === 0) return 'none'
    // Build SVG grid overlay
    const lines = majorTicks
      .map((t) => `<line x1="${t.x}" y1="0" x2="${t.x}" y2="100%" stroke="%23464d6412" stroke-width="1"/>`)
      .join('')
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${trackWidth}' height='100'>${lines}</svg>`
    return `url("data:image/svg+xml,${svg}")`
  }, [duration, trackWidth])

  return (
    <div
      ref={containerRef}
      className="tl-panel"
      style={{ height: panelHeight }}
    >
      {/* Resize handle */}
      <div className="tl-resize-handle" onMouseDown={handleResizeStart}>
        <div className="tl-resize-grip" />
      </div>

      {/* Top bar: label + time readout */}
      <div className="tl-topbar">
        <div className="tl-topbar-label">TIMELINE</div>
        <div className="tl-topbar-spacer" />
        <div className="tl-time-readout">
          <span className="tl-time-current">{formatTime(playheadPosition)}</span>
          <span className="tl-time-sep">/</span>
          <span className="tl-time-total">{formatTime(duration)}</span>
        </div>
      </div>

      {/* Ruler row (header blank + ruler canvas) */}
      <div className="tl-ruler-row">
        <div className="tl-header-cell tl-ruler-corner" />
        <div className="tl-ruler-track" ref={trackAreaRef}>
          <TimeRuler
            duration={duration}
            width={trackWidth}
            playheadFraction={playheadFraction}
            onSeek={handleTimelineClick}
          />
        </div>
      </div>

      {/* Track rows */}
      <div className="tl-tracks-scroll">
        {sources.length === 0 && (
          <div className="tl-empty">
            Drop audio files to begin
          </div>
        )}

        {sources.map((source, index) => {
          const buf = audioEngine.getAudioBuffer(source.id)
          const sourceDuration = buf?.duration ?? 0
          const hasKeyframes = (animations[source.id]?.keyframes.length ?? 0) > 0
          const isExpanded = expandedLanes.has(source.id)

          return (
            <div key={source.id} className="tl-track-group">
              {/* Main waveform row */}
              <div className="tl-track-row">
                {/* Track header */}
                <div className="tl-header-cell">
                  <div className="tl-track-number">{index + 1}</div>
                  <div
                    className="tl-track-led"
                    style={{
                      background: source.color,
                      boxShadow: `0 0 6px ${source.color}50`,
                    }}
                  />
                  <div className="tl-track-label">{source.label}</div>
                  <div className="tl-track-btns">
                    <button
                      className={`tl-btn ${isExpanded ? 'tl-btn--active-amber' : ''}`}
                      onClick={() => toggleLane(source.id)}
                      title={isExpanded ? 'Hide automation' : `Show automation${hasKeyframes ? ` (${animations[source.id].keyframes.length} kf)` : ''}`}
                    >
                      A
                    </button>
                    <button
                      className={`tl-btn ${source.isMuted ? 'tl-btn--active-red' : ''}`}
                      onClick={() => setSourceMuted(source.id, !source.isMuted)}
                      title={source.isMuted ? 'Unmute' : 'Mute'}
                    >
                      M
                    </button>
                    <button
                      className={`tl-btn ${source.isSoloed ? 'tl-btn--active-amber' : ''}`}
                      onClick={() => setSourceSoloed(source.id, !source.isSoloed)}
                      title={source.isSoloed ? 'Unsolo' : 'Solo'}
                    >
                      S
                    </button>
                  </div>
                </div>

                {/* Waveform area */}
                <div
                  className="tl-waveform-area"
                  style={{ backgroundImage: gridBg }}
                  onClick={handleTimelineClick}
                >
                  {sourceDuration > 0 && (
                    <WaveformRow
                      sourceId={source.id}
                      color={source.color}
                      duration={sourceDuration}
                      totalDuration={duration}
                      width={trackWidth}
                    />
                  )}
                  {/* Playhead line */}
                  <div
                    className="tl-playhead-line"
                    style={{ left: `${playheadFraction * 100}%` }}
                  />
                </div>
              </div>

              {/* Automation lane */}
              {isExpanded && (
                <div className="tl-track-row tl-track-row--lane">
                  <div className="tl-header-cell tl-header-cell--lane">
                    <span className="tl-lane-label">POS</span>
                    {hasKeyframes && (
                      <span className="tl-lane-count">{animations[source.id].keyframes.length}</span>
                    )}
                  </div>
                  <div className="tl-waveform-area tl-waveform-area--lane" style={{ backgroundImage: gridBg }}>
                    <AutomationLane
                      sourceId={source.id}
                      color={source.color}
                      totalDuration={duration}
                      width={trackWidth}
                    />
                    <div
                      className="tl-playhead-line"
                      style={{ left: `${playheadFraction * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Time formatters                                                   */
/* ------------------------------------------------------------------ */

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00.0'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 10)
  return `${m}:${s.toString().padStart(2, '0')}.${ms}`
}

function formatTimeCompact(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}
