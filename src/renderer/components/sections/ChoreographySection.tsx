import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useAppStore } from '../../stores/useAppStore'
import { useTransportStore } from '../../stores/useTransportStore'
import { useChoreography } from '../../hooks/useChoreography'
import { useToast } from '../ToastContext'
import type { ChoreographyBehaviour } from '../../audio/Choreography'
import type { SourceId, SourcePosition } from '../../types'

// --- Register metadata ---

type Register = 'tension' | 'intimacy' | 'release' | 'disorientation' | 'conversation'

interface PrimitiveInfo {
  type: ChoreographyBehaviour['type']
  label: string
  register: Register
  description: string
  needsSecondary: boolean
  /** SVG path data representing the motion trajectory (viewBox 0 0 32 32) */
  pathData: string
  /** Optional second path for dual-source primitives */
  pathData2?: string
}

const PRIMITIVES: PrimitiveInfo[] = [
  {
    type: 'closing_walls', label: 'Closing Walls', register: 'tension',
    description: 'Narrowing stereo image, claustrophobic compression',
    needsSecondary: false,
    pathData: 'M4 16 L10 8 L10 24 Z M28 16 L22 8 L22 24 Z',
  },
  {
    type: 'pendulum_decay', label: 'Pendulum Decay', register: 'tension',
    description: 'Asymmetric swing with approach, spatial instability',
    needsSecondary: false,
    pathData: 'M2 16 Q8 4 12 16 Q14 22 16 16 Q17.5 12 19 16 Q20 18 21 16 Q22 14.5 23 16 L26 16',
  },
  {
    type: 'stalking_shadow', label: 'Stalking Shadow', register: 'tension',
    description: 'Rear-hemisphere spiral, cone-of-confusion threat',
    needsSecondary: false,
    pathData: 'M16 28 Q22 26 24 22 Q26 18 22 14 Q18 10 14 14 Q10 18 14 20 Q16 22 18 18',
  },
  {
    type: 'whisper_approach', label: 'Whisper Approach', register: 'intimacy',
    description: 'Near-field drift, proximity effect warmth',
    needsSecondary: false,
    pathData: 'M28 16 C24 16 20 15.5 16 15 C12 14.5 10 15 8 16 L4 16',
  },
  {
    type: 'breathing_radius', label: 'Breathing Radius', register: 'intimacy',
    description: 'Rhythmic distance oscillation at breathing rate',
    needsSecondary: false,
    pathData: 'M2 16 C5 10 8 10 11 16 C14 22 17 22 20 16 C23 10 26 10 29 16',
  },
  {
    type: 'arrival_settle', label: 'Arrival Settle', register: 'release',
    description: 'Logarithmic spiral convergence to rest',
    needsSecondary: false,
    pathData: 'M4 6 Q28 4 26 16 Q24 26 14 22 Q6 18 10 14 Q14 10 16 14 L16 16',
  },
  {
    type: 'horizon_drift', label: 'Horizon Drift', register: 'release',
    description: 'Slow azimuthal glide, meditative calm',
    needsSecondary: false,
    pathData: 'M4 18 C8 14 12 13 16 13 C20 13 24 14 28 18',
  },
  {
    type: 'float_descent', label: 'Float Descent', register: 'release',
    description: 'Vertical settling with gentle lateral sway',
    needsSecondary: false,
    pathData: 'M16 4 C12 8 20 12 14 16 C10 20 22 24 16 28',
  },
  {
    type: 'phantom_split', label: 'Phantom Split', register: 'disorientation',
    description: 'Rapid alternation at precedence-effect boundary',
    needsSecondary: false,
    pathData: 'M6 8 L26 8 L6 14 L26 14 L6 20 L26 20 L6 26 L26 26',
  },
  {
    type: 'vertigo_helix', label: 'Vertigo Helix', register: 'disorientation',
    description: 'Helical path crossing overhead, elevation vertigo',
    needsSecondary: false,
    pathData: 'M8 28 C2 24 24 22 20 18 C16 14 6 14 10 10 C14 6 26 6 22 4',
  },
  {
    type: 'call_response', label: 'Call & Response', register: 'conversation',
    description: 'Two sources alternate approach and retreat',
    needsSecondary: true,
    pathData: 'M4 10 L16 10 M16 10 L12 7 M16 10 L12 13',
    pathData2: 'M28 22 L16 22 M16 22 L20 19 M16 22 L20 25',
  },
  {
    type: 'orbit_counterpoint', label: 'Orbit Counterpoint', register: 'conversation',
    description: 'Counter-rotating orbits with phase offset',
    needsSecondary: true,
    pathData: 'M16 6 A10 10 0 1 1 15.9 6',
    pathData2: 'M16 26 A10 10 0 1 0 16.1 26',
  },
  {
    type: 'mirror_dance', label: 'Mirror Dance', register: 'conversation',
    description: 'Median-plane reflection of motion',
    needsSecondary: true,
    pathData: 'M8 8 Q4 16 8 24',
    pathData2: 'M24 8 Q28 16 24 24',
  },
]

const REGISTER_META: Record<Register, { label: string; color: string; glow: string; gradient: string }> = {
  tension:        { label: 'TENSION',        color: '#e84057', glow: 'rgba(232, 64, 87, 0.25)',   gradient: 'linear-gradient(135deg, #e84057, #c2243a)' },
  intimacy:       { label: 'INTIMACY',       color: '#d4a0e8', glow: 'rgba(212, 160, 232, 0.25)', gradient: 'linear-gradient(135deg, #d4a0e8, #b070d0)' },
  release:        { label: 'RELEASE',        color: '#0ea5a0', glow: 'rgba(14, 165, 160, 0.25)',  gradient: 'linear-gradient(135deg, #0ea5a0, #0c8783)' },
  disorientation: { label: 'DISORIENTATION', color: '#e8a027', glow: 'rgba(232, 160, 39, 0.25)',  gradient: 'linear-gradient(135deg, #e8a027, #c5871c)' },
  conversation:   { label: 'CONVERSATION',   color: '#5a9cf5', glow: 'rgba(90, 156, 245, 0.25)',  gradient: 'linear-gradient(135deg, #5a9cf5, #3d7ed4)' },
}

const REGISTERS: Register[] = ['tension', 'intimacy', 'release', 'disorientation', 'conversation']

// --- Param presets ---

function buildBehaviour(
  type: ChoreographyBehaviour['type'],
  durationBeats: number,
  secondarySourceId?: SourceId,
  secondaryPosition?: SourcePosition,
): ChoreographyBehaviour {
  const base = { durationBeats }
  switch (type) {
    case 'closing_walls': return { type, ...base }
    case 'pendulum_decay': return { type, ...base }
    case 'stalking_shadow': return { type, ...base }
    case 'whisper_approach': return { type, ...base }
    case 'breathing_radius': return { type, ...base }
    case 'arrival_settle': return { type, ...base }
    case 'horizon_drift': return { type, ...base }
    case 'float_descent': return { type, ...base }
    case 'phantom_split': return { type, ...base }
    case 'vertigo_helix': return { type, ...base }
    case 'call_response': return { type, ...base, secondarySourceId: secondarySourceId!, secondaryStartPosition: secondaryPosition! }
    case 'orbit_counterpoint': return { type, ...base, secondarySourceId: secondarySourceId! }
    case 'mirror_dance': return { type, ...base, secondarySourceId: secondarySourceId! }
  }
}

// --- Motion path icon ---

function MotionIcon({ prim, color, active }: { prim: PrimitiveInfo; color: string; active: boolean }) {
  return (
    <svg className="choreo-motion-icon" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path
        d={prim.pathData}
        stroke={active ? color : 'var(--text-muted)'}
        strokeWidth={active ? 2 : 1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        className={active ? 'choreo-motion-path--active' : ''}
      />
      {prim.pathData2 && (
        <path
          d={prim.pathData2}
          stroke={active ? color : 'var(--text-muted)'}
          strokeWidth={active ? 2 : 1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity={active ? 0.6 : 0.35}
          strokeDasharray={active ? 'none' : '2 2'}
        />
      )}
    </svg>
  )
}

// --- BPM Pulse ---

function BpmPulse({ bpm }: { bpm: number }) {
  const dotRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!dotRef.current) return
    const ms = 60000 / Math.max(1, bpm)
    dotRef.current.style.animationDuration = `${ms}ms`
  }, [bpm])

  return <span ref={dotRef} className="choreo-bpm-pulse" />
}

// --- Component ---

export function ChoreographySection() {
  const { showToast } = useToast()
  const { apply } = useChoreography()
  const sources = useAppStore((s) => s.sources)
  const selectedSourceId = useAppStore((s) => s.selectedSourceId)
  const bpm = useAppStore((s) => s.bpm)
  const setBpm = useAppStore((s) => s.setBpm)
  const duration = useTransportStore((s) => s.duration)

  const [activeRegister, setActiveRegister] = useState<Register>('tension')
  const [selectedType, setSelectedType] = useState<ChoreographyBehaviour['type']>('closing_walls')
  const [durationBeats, setDurationBeats] = useState(8)
  const [secondarySourceId, setSecondarySourceId] = useState<SourceId | ''>('')

  const selectedPrimitive = useMemo(
    () => PRIMITIVES.find((p) => p.type === selectedType)!,
    [selectedType],
  )

  const filteredPrimitives = useMemo(
    () => PRIMITIVES.filter((p) => p.register === activeRegister),
    [activeRegister],
  )

  const otherSources = useMemo(
    () => sources.filter((s) => s.id !== selectedSourceId),
    [sources, selectedSourceId],
  )

  const canApply = useMemo(() => {
    if (!selectedSourceId) return false
    if (duration <= 0) return false
    if (selectedPrimitive.needsSecondary && !secondarySourceId) return false
    return true
  }, [selectedSourceId, duration, selectedPrimitive, secondarySourceId])

  const handleApply = useCallback(() => {
    if (!canApply || !selectedSourceId) return

    const secondary = secondarySourceId || undefined
    const secondaryPos = secondary
      ? sources.find((s) => s.id === secondary)?.position
      : undefined

    const behaviour = buildBehaviour(selectedType, durationBeats, secondary, secondaryPos)
    apply(selectedSourceId, behaviour)

    const src = sources.find((s) => s.id === selectedSourceId)
    showToast(`${selectedPrimitive.label} applied to ${src?.label ?? 'source'}`, 'success')
  }, [canApply, selectedSourceId, secondarySourceId, selectedType, durationBeats, sources, apply, showToast, selectedPrimitive])

  const registerMeta = REGISTER_META[activeRegister]
  const beatDurationSec = 60 / Math.max(1, bpm)
  const totalTimeSec = (durationBeats * beatDurationSec).toFixed(1)

  return (
    <div className="choreo-panel">
      {/* BPM control */}
      <div className="choreo-bpm-row">
        <BpmPulse bpm={bpm} />
        <span className="choreo-bpm-label">BPM</span>
        <input
          type="number"
          className="choreo-bpm-input"
          value={bpm}
          min={1}
          max={999}
          onChange={(e) => setBpm(parseInt(e.target.value) || 120)}
        />
        <div className="choreo-bpm-presets">
          {[60, 80, 120, 140].map((v) => (
            <button
              key={v}
              className={`choreo-bpm-preset ${bpm === v ? 'choreo-bpm-preset--active' : ''}`}
              onClick={() => setBpm(v)}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Register tabs */}
      <div className="choreo-register-strip">
        {REGISTERS.map((r) => {
          const meta = REGISTER_META[r]
          const isActive = r === activeRegister
          return (
            <button
              key={r}
              className={`choreo-register-tab ${isActive ? 'choreo-register-tab--active' : ''}`}
              onClick={() => {
                setActiveRegister(r)
                const first = PRIMITIVES.find((p) => p.register === r)
                if (first) setSelectedType(first.type)
              }}
              style={{
                '--reg-color': meta.color,
                '--reg-glow': meta.glow,
                '--reg-gradient': meta.gradient,
              } as React.CSSProperties}
            >
              <span className="choreo-register-bar" />
              <span className="choreo-register-name">{meta.label}</span>
            </button>
          )
        })}
      </div>

      {/* Primitive selector */}
      <div className="choreo-primitive-grid">
        {filteredPrimitives.map((p) => {
          const isSelected = selectedType === p.type
          return (
            <button
              key={p.type}
              className={`choreo-primitive-card ${isSelected ? 'choreo-primitive-card--selected' : ''}`}
              onClick={() => setSelectedType(p.type)}
              style={{
                '--card-color': registerMeta.color,
                '--card-glow': registerMeta.glow,
              } as React.CSSProperties}
            >
              <MotionIcon prim={p} color={registerMeta.color} active={isSelected} />
              <div className="choreo-primitive-text">
                <span className="choreo-primitive-name">{p.label}</span>
                <span className="choreo-primitive-desc">{p.description}</span>
              </div>
            </button>
          )
        })}
      </div>

      {/* Parameters */}
      <div className="choreo-params">
        <div className="choreo-param-row">
          <div className="choreo-param-header">
            <span className="choreo-param-label">Duration</span>
            <span className="choreo-param-value">
              {durationBeats}<span className="choreo-param-unit">beats</span>
              <span className="choreo-param-time">{totalTimeSec}s</span>
            </span>
          </div>
          <div className="choreo-slider-track">
            <input
              type="range"
              min={1}
              max={64}
              step={1}
              value={durationBeats}
              onChange={(e) => setDurationBeats(parseInt(e.target.value))}
              style={{ '--slider-pct': `${((durationBeats - 1) / 63) * 100}%`, '--slider-color': registerMeta.color } as React.CSSProperties}
            />
            {/* Beat markers at 8-beat intervals */}
            <div className="choreo-beat-marks">
              {[1, 8, 16, 32, 64].map((v) => (
                <span key={v} className="choreo-beat-mark" style={{ left: `${((v - 1) / 63) * 100}%` }}>
                  {v}
                </span>
              ))}
            </div>
          </div>
        </div>

        {selectedPrimitive.needsSecondary && (
          <div className="choreo-param-row">
            <div className="choreo-param-header">
              <span className="choreo-param-label">Partner Source</span>
            </div>
            <select
              className="choreo-select"
              value={secondarySourceId}
              onChange={(e) => setSecondarySourceId(e.target.value)}
            >
              <option value="">-- select partner --</option>
              {otherSources.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Apply */}
      <button
        className="choreo-apply-btn"
        disabled={!canApply}
        onClick={handleApply}
        style={{
          '--apply-color': registerMeta.color,
          '--apply-glow': registerMeta.glow,
          '--apply-gradient': registerMeta.gradient,
        } as React.CSSProperties}
      >
        <span className="choreo-apply-icon" />
        <span>Apply {selectedPrimitive.label}</span>
      </button>

      {/* Status hint */}
      {!selectedSourceId && (
        <div className="choreo-hint">
          <span className="choreo-hint-dot" />
          Select a source to apply choreography
        </div>
      )}
      {selectedSourceId && duration <= 0 && (
        <div className="choreo-hint">
          <span className="choreo-hint-dot" />
          Load audio first to set duration
        </div>
      )}
    </div>
  )
}
