import { useAppStore } from '../stores/useAppStore'
import { SessionSection } from './sections/SessionSection'
import { OutputSection } from './sections/OutputSection'
import { SourceList } from './SourceList'
import { SourcePropertiesSection } from './sections/SourcePropertiesSection'
import { TransportSection } from './sections/TransportSection'
import { EnvironmentSection } from './sections/EnvironmentSection'
import { VideoSection } from './sections/VideoSection'
import { PluginPanel } from './PluginPanel'
import { CameraSection } from './sections/CameraSection'

/**
 * Main sidebar control panel for SonarLox.
 * Orchestrates logical sections for project management, audio output, 
 * transport, spatial settings, and plugins.
 */
export function ControlPanel() {
  const selectedSourceId = useAppStore((s) => s.selectedSourceId)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Brand */}
      <div style={{ paddingBottom: 2 }}>
        <h2 className="logo">Sonar<span className="logo-accent">Lox</span></h2>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', letterSpacing: '1px', marginTop: 2 }}>
          SPATIAL AUDIO EDITOR
        </div>
      </div>

      <div className="divider" />

      <SessionSection />
      <div className="divider" />
      
      <OutputSection />
      <div className="divider" />

      <SourceList />
      <div className="divider" />

      {selectedSourceId && (
        <>
          <SourcePropertiesSection />
          <div className="divider" />
        </>
      )}
      
      <TransportSection />
      <div className="divider" />

      <EnvironmentSection />
      <div className="divider" />

      <VideoSection />
      <div className="divider" />

      <PluginPanel />
      <div className="divider" />

      <CameraSection />

      {/* Bottom spacer for scroll */}
      <div style={{ height: 8 }} />
    </div>
  )
}
