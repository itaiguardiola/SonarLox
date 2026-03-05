import { useState, useRef, useEffect } from 'react'
import { useAppStore } from '../stores/useAppStore'

interface DemucsSetupModalProps {
  onClose: () => void
}

export function DemucsSetupModal({ onClose }: DemucsSetupModalProps) {
  const [installing, setInstalling] = useState(false)
  const [log, setLog] = useState('')
  const [error, setError] = useState<string | null>(null)
  const setDemucsProbe = useAppStore((s) => s.setDemucsProbe)
  const logRef = useRef<HTMLPreElement>(null)

  // Auto-scroll log to bottom
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [log])

  const handleInstall = async () => {
    setInstalling(true)
    setError(null)
    setLog('$ pip install -U demucs\n')

    // Subscribe to pip output stream
    const dispose = window.api.onDemucsInstallLog((line) => {
      setLog((prev) => prev + line)
    })

    try {
      const result = await window.api.demucsInstall()
      dispose()

      if (result.success) {
        setLog((prev) => prev + '\nInstallation complete. Checking availability...\n')
        const probe = await window.api.demucsProbe()
        setDemucsProbe(probe)
        if (probe.available) {
          setLog((prev) => prev + `Demucs ready (${probe.gpuType.toUpperCase()})`)
          setTimeout(onClose, 1500)
        } else {
          setError('Installation succeeded but demucs probe failed. Try restarting the app.')
        }
      } else {
        setError(result.error ?? 'Installation failed')
        setLog((prev) => prev + '\n' + (result.error ?? 'Unknown error'))
      }
    } catch (err) {
      dispose()
      setError(String(err))
    } finally {
      setInstalling(false)
    }
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        background: 'var(--bg-panel, #1a1a2e)',
        border: '1px solid var(--border-subtle, #333)',
        borderRadius: 8,
        padding: 24,
        maxWidth: 440,
        width: '90%',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}>
        <h3 style={{
          margin: 0,
          fontSize: 14,
          color: 'var(--text-bright, #fff)',
          fontFamily: 'var(--font-mono)',
        }}>
          Stem Separation Setup
        </h3>

        <p style={{
          margin: 0,
          fontSize: 12,
          color: 'var(--text-secondary, #aaa)',
          lineHeight: 1.5,
        }}>
          SonarLox can automatically split any audio into stems (drums, bass, vocals, other)
          and place each one in 3D space. Requires Python 3.8+ and ~500MB download.
        </p>

        {log && (
          <pre
            ref={logRef}
            style={{
              margin: 0,
              padding: 8,
              background: 'var(--bg-sunken, #111)',
              border: '1px solid var(--border-subtle, #333)',
              borderRadius: 4,
              fontSize: 10,
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-primary, #ccc)',
              maxHeight: 160,
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}
          >
            {log}
          </pre>
        )}

        {installing && (
          <div style={{
            height: 3,
            background: 'var(--bg-sunken, #111)',
            borderRadius: 2,
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: '40%',
              background: 'var(--accent-teal, #00cccc)',
              borderRadius: 2,
              animation: 'demucsInstallPulse 1.5s ease-in-out infinite',
            }} />
            <style>{`
              @keyframes demucsInstallPulse {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(350%); }
              }
            `}</style>
          </div>
        )}

        {error && (
          <div style={{
            padding: '6px 8px',
            background: 'rgba(255,50,50,0.1)',
            border: '1px solid rgba(255,50,50,0.3)',
            borderRadius: 4,
            fontSize: 11,
            color: '#ff6666',
          }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            className="btn"
            onClick={handleInstall}
            disabled={installing}
            style={{
              fontSize: 12,
              padding: '8px 12px',
              textAlign: 'center',
              color: 'var(--accent-teal, #00cccc)',
              borderColor: 'var(--accent-teal, #00cccc)',
            }}
          >
            {installing ? 'Installing...' : 'Install Automatically'}
          </button>

          <button
            className="btn"
            onClick={onClose}
            disabled={installing}
            style={{
              fontSize: 12,
              padding: '8px 12px',
              textAlign: 'center',
              color: 'var(--text-muted, #666)',
            }}
          >
            {installing ? 'Cancel' : 'Not now'}
          </button>
        </div>
      </div>
    </div>
  )
}
