import { useAppStore } from '../../stores/useAppStore'

export function CameraSection() {
  const cameraPresets = useAppStore((s) => s.cameraPresets)
  const setCameraCommand = useAppStore((s) => s.setCameraCommand)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span className="section-label">Camera</span>
      <div style={{ display: 'flex', gap: 5 }}>
        <button className="btn" onClick={() => setCameraCommand({ type: 'home' })} style={{ flex: 1 }}>Home</button>
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
            title={cameraPresets[i] ? `Recall preset ${i + 1} (Shift+click to save)` : `Shift+click to save preset ${i + 1}`}
          >
            {i + 1}
          </button>
        ))}
      </div>
      <span className="readout-small">SHIFT+CLICK TO SAVE</span>
    </div>
  )
}
