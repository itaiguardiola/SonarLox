import { useAppStore } from '../../stores/useAppStore'

export function EnvironmentSection() {
  const listenerY = useAppStore((s) => s.listenerY)
  const setListenerY = useAppStore((s) => s.setListenerY)
  const roomSize = useAppStore((s) => s.roomSize)
  const setRoomSize = useAppStore((s) => s.setRoomSize)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="cp-section-label">Listener Height</span>
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="cp-section-label">Room Size</span>
          <span className="slider-value">{roomSize[0]}x{roomSize[1]}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 10 }}>W</span>
            <input
              type="range"
              min={10}
              max={50}
              step={2}
              value={roomSize[0]}
              onMouseDown={() => useAppStore.getState().recordHistory('Change room width')}
              onChange={(e) => setRoomSize([parseInt(e.target.value), roomSize[1]])}
              style={{ flex: 1 }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 10 }}>D</span>
            <input
              type="range"
              min={10}
              max={50}
              step={2}
              value={roomSize[1]}
              onMouseDown={() => useAppStore.getState().recordHistory('Change room depth')}
              onChange={(e) => setRoomSize([roomSize[0], parseInt(e.target.value)])}
              style={{ flex: 1 }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
