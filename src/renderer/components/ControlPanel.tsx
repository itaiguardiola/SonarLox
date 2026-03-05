import { useAppStore } from '../stores/useAppStore'
import { Section } from './Section'
import { SessionSection } from './sections/SessionSection'
import { OutputSection } from './sections/OutputSection'
import { SourceList } from './SourceList'
import { SourcePropertiesSection } from './sections/SourcePropertiesSection'
import { TransportSection } from './sections/TransportSection'
import { EnvironmentSection } from './sections/EnvironmentSection'
import { VideoSection } from './sections/VideoSection'
import { PluginPanel } from './PluginPanel'
import { CameraSection } from './sections/CameraSection'

export function ControlPanel() {
  const selectedSourceId = useAppStore((s) => s.selectedSourceId)
  const sourceCount = useAppStore((s) => s.sources.length)
  const hasVideo = useAppStore((s) => s.videoFilePath !== null)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Brand */}
      <div style={{ paddingBottom: 4 }}>
        <h2 className="logo">Sonar<span className="logo-accent">Lox</span></h2>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', letterSpacing: '1px', marginTop: 2 }}>
          SPATIAL AUDIO EDITOR
        </div>
      </div>

      <div className="divider" />

      <Section label="Session">
        <SessionSection />
      </Section>

      <div className="divider" />

      <Section
        label="Sources"
        accessory={
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
            {sourceCount}/8
          </span>
        }
      >
        <SourceList />
        {selectedSourceId && (
          <>
            <div className="divider" style={{ margin: '4px 0' }} />
            <SourcePropertiesSection />
          </>
        )}
      </Section>

      <div className="divider" />

      <Section label="Transport">
        <TransportSection />
      </Section>

      <div className="divider" />

      <Section label="Output">
        <OutputSection />
      </Section>

      <div className="divider" />

      <Section label="Environment" defaultCollapsed>
        <EnvironmentSection />
      </Section>

      <div className="divider" />

      <Section label="Video Sync" defaultCollapsed={!hasVideo}>
        <VideoSection />
      </Section>

      <div className="divider" />

      <Section label="Plugins" defaultCollapsed>
        <PluginPanel />
      </Section>

      <div className="divider" />

      <Section label="Camera" defaultCollapsed>
        <CameraSection />
      </Section>

      {/* Bottom spacer for scroll */}
      <div style={{ height: 8 }} />
    </div>
  )
}
