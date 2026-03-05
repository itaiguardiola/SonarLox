import { useState, useEffect, useCallback } from 'react'
import { useAppStore } from '../stores/useAppStore'
import { usePluginStore } from '../plugins/usePluginStore'
import { loadPlugin, unloadPlugin } from '../plugins/pluginLoader'
import { rebuildEffectChain, rebuildAllEffectChains } from '../plugins/effectChain'
import { useToast } from './Toast'
import { PluginEditor } from './PluginEditor'
import type { PluginManifest, PluginInstance } from '../plugins/types'

export function PluginPanel() {
  const { showToast } = useToast()
  const availablePlugins = usePluginStore((s) => s.availablePlugins)
  const activePlugins = usePluginStore((s) => s.activePlugins)
  const isScanning = usePluginStore((s) => s.isScanning)
  const sources = useAppStore((s) => s.sources)

  const [pluginsDir, setPluginsDir] = useState<string>('')
  const [selectedPluginId, setSelectedPluginId] = useState<string | null>(null)

  // Scan for plugins on mount
  useEffect(() => {
    handleScan()
    if (window.api?.getPluginsDir) {
      window.api.getPluginsDir().then(setPluginsDir)
    }
  }, [])

  const handleScan = useCallback(async () => {
    if (!window.api?.scanPlugins) return
    usePluginStore.getState().setIsScanning(true)
    try {
      const manifests = await window.api.scanPlugins()
      usePluginStore.getState().setAvailablePlugins(manifests)
    } catch {
      showToast('Failed to scan plugins', 'error')
    } finally {
      usePluginStore.getState().setIsScanning(false)
    }
  }, [showToast])

  const handleToggleActive = useCallback(async (manifest: PluginManifest) => {
    const store = usePluginStore.getState()
    const existing = store.activePlugins.get(manifest.id)

    if (existing) {
      unloadPlugin(manifest.id)
      store.deactivatePlugin(manifest.id)
      rebuildAllEffectChains()
      showToast(`Disabled ${manifest.name}`, 'info')
      if (selectedPluginId === manifest.id) setSelectedPluginId(null)
    } else {
      try {
        const instance = await loadPlugin(manifest)
        store.activatePlugin(instance)
        if (manifest.type === 'audio-effect') {
          rebuildEffectChain(instance.target as any)
        }
        showToast(`Enabled ${manifest.name}`, 'success')
      } catch (err) {
        showToast(`Failed to load ${manifest.name}: ${err}`, 'error')
      }
    }
  }, [showToast, selectedPluginId])

  const handleTargetChange = useCallback((pluginId: string, target: string) => {
    const store = usePluginStore.getState()
    const instance = store.activePlugins.get(pluginId)
    if (!instance) return

    const oldTarget = instance.target
    store.setPluginTarget(pluginId, target as any)

    // Rebuild chains for both old and new targets
    if (instance.manifest.type === 'audio-effect') {
      rebuildEffectChain(oldTarget)
      rebuildEffectChain(target as any)
    }
  }, [])

  const selectedInstance = selectedPluginId ? activePlugins.get(selectedPluginId) : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="section-label" style={{ paddingBottom: 0 }}>Plugins</span>
        <button
          className="btn-icon"
          onClick={handleScan}
          disabled={isScanning}
          title="Rescan plugins directory"
          style={{ fontSize: 11 }}
        >
          {isScanning ? '...' : 'Scan'}
        </button>
      </div>

      {availablePlugins.length === 0 ? (
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: 'var(--text-muted)',
          lineHeight: 1.5,
        }}>
          No plugins found.
          {pluginsDir && (
            <div style={{ marginTop: 4, wordBreak: 'break-all' }}>
              Place plugins in: <span style={{ color: 'var(--text-secondary)' }}>{pluginsDir}</span>
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {availablePlugins.map((manifest) => {
            const isActive = activePlugins.has(manifest.id)
            const instance = activePlugins.get(manifest.id)

            return (
              <div key={manifest.id} style={{
                background: 'var(--bg-elevated)',
                border: `1px solid ${isActive ? 'var(--accent-teal)' : 'var(--border-subtle)'}`,
                borderRadius: 4,
                padding: '6px 8px',
              }}>
                {/* Plugin header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    className={`btn-icon ${isActive ? 'btn-icon--soloed' : ''}`}
                    onClick={() => handleToggleActive(manifest)}
                    style={{ fontSize: 9, width: 18, height: 18 }}
                    title={isActive ? 'Disable plugin' : 'Enable plugin'}
                  >
                    {isActive ? 'ON' : 'OFF'}
                  </button>
                  <span style={{
                    flex: 1,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {manifest.name}
                  </span>
                  {isActive && (
                    <button
                      className="btn-icon"
                      onClick={() => setSelectedPluginId(manifest.id)}
                      style={{ fontSize: 10, width: 18, height: 18 }}
                      title="Open editor"
                    >
                      EDIT
                    </button>
                  )}
                  {!isActive && (
                     <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 8,
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                    }}>
                      {manifest.type.replace('audio-', '')}
                    </span>
                  )}
                </div>

                {/* Target selector for audio effects */}
                {isActive && instance && manifest.type === 'audio-effect' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6, borderTop: '1px solid var(--border-subtle)', paddingTop: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>TARGET</span>
                    <select
                      value={instance.target}
                      onChange={(e) => handleTargetChange(manifest.id, e.target.value)}
                      style={{
                        flex: 1,
                        background: 'transparent',
                        color: 'var(--text-secondary)',
                        border: 'none',
                        fontSize: 9,
                        fontFamily: 'var(--font-mono)',
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      <option value="master">MASTER</option>
                      {sources.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {selectedInstance && (
        <PluginEditor
          instance={selectedInstance}
          onClose={() => setSelectedPluginId(null)}
        />
      )}
    </div>
  )
}
