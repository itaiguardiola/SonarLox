import { Viewport } from './components/Viewport'
import { ControlPanel } from './components/ControlPanel'

export default function App() {
  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh' }}>
      <div style={{ flex: 1, background: '#08090d' }}>
        <Viewport />
      </div>
      <div
        className="panel"
        style={{
          width: 320,
          padding: '16px 14px',
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        <ControlPanel />
      </div>
    </div>
  )
}
