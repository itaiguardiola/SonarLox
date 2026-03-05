import { useState, useCallback } from 'react'
import { useAppStore } from '../stores/useAppStore'
import { usePluginStore } from '../plugins/usePluginStore'
import { loadPlugin, unloadPlugin } from '../plugins/pluginLoader'
import { rebuildEffectChain, rebuildAllEffectChains } from '../plugins/effectChain'
import { useToast } from './Toast'
import type { PluginManifest, PluginParameterDef, PluginParameterValue } from '../plugins/types'

const TYPE_LABELS: Record<string, string> = {
  'audio-effect': 'FX',
  visualizer: 'VIZ',
  exporter: 'EXP',
  'source-generator': 'GEN',
}

export function PluginPanel() {
  const { showToast } = useToast()
  const availablePlugins = usePluginStore((s) => s.availablePlugins)
  const activePlugins = usePluginStore((s) => s.activePlugins)
  const sources = useAppStore((s) => s.sources)
  const recordHistory = useAppStore((s) => s.recordHistory)

  const [expandedId, setExpandedId] = useState<string | null>(null)

  const handleImport = useCallback(async () => {
    if (!window.api?.importPlugin) return
    try {
      const manifest = await window.api.importPlugin()
      if (manifest) {
        await usePluginStore.getState().scanPlugins()
        showToast(`Imported ${manifest.name}`, 'success')
      }
    } catch {
      showToast('Failed to import plugin', 'error')
    }
  }, [showToast])

  const handleOpenFolder = useCallback(async () => {
    if (window.api?.openPluginsFolder) {
      await window.api.openPluginsFolder()
    }
  }, [])

  const handleRemove = useCallback(async (manifest: PluginManifest) => {
    if (!window.api?.removePlugin || !window.api?.showConfirmDialog) return
    const result = await window.api.showConfirmDialog({
      message: `Remove plugin "${manifest.name}"?`,
      detail: 'This will delete the plugin files from disk.',
      buttons: ['Remove', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
    })
    if (result !== 0) return

    const store = usePluginStore.getState()
    if (store.activePlugins.has(manifest.id)) {
      unloadPlugin(manifest.id)
      store.deactivatePlugin(manifest.id)
      rebuildAllEffectChains()
    }

    const removed = await window.api.removePlugin(manifest.id)
    if (removed) {
      await store.scanPlugins()
      showToast(`Removed ${manifest.name}`, 'info')
      if (expandedId === manifest.id) setExpandedId(null)
    }
  }, [showToast, expandedId])

  const handleToggleActive = useCallback(async (manifest: PluginManifest) => {
    const store = usePluginStore.getState()
    const existing = store.activePlugins.get(manifest.id)

    if (existing) {
      unloadPlugin(manifest.id)
      store.deactivatePlugin(manifest.id)
      rebuildAllEffectChains()
      showToast(`Disabled ${manifest.name}`, 'info')
      if (expandedId === manifest.id) setExpandedId(null)
    } else {
      try {
        const instance = await loadPlugin(manifest)
        store.activatePlugin(instance)
        if (manifest.type === 'audio-effect') {
          rebuildEffectChain(instance.target)
        }
        showToast(`Enabled ${manifest.name}`, 'success')
      } catch (err) {
        showToast(`Failed to load ${manifest.name}: ${err}`, 'error')
      }
    }
  }, [showToast, expandedId])

  const handleTargetChange = useCallback((pluginId: string, target: string) => {
    const store = usePluginStore.getState()
    const instance = store.activePlugins.get(pluginId)
    if (!instance) return

    const oldTarget = instance.target
    store.setPluginTarget(pluginId, target as any)

    if (instance.manifest.type === 'audio-effect') {
      rebuildEffectChain(oldTarget)
      rebuildEffectChain(target as any)
    }
  }, [])

  const handleMoveUp = useCallback((pluginId: string) => {
    const store = usePluginStore.getState()
    const instance = store.activePlugins.get(pluginId)
    if (!instance || instance.manifest.type !== 'audio-effect') return

    const siblings = getSortedSiblings(instance.target)
    const idx = siblings.findIndex((s) => s.manifest.id === pluginId)
    if (idx <= 0) return

    store.swapPluginSlots(pluginId, siblings[idx - 1].manifest.id)
    rebuildEffectChain(instance.target)
  }, [])

  const handleMoveDown = useCallback((pluginId: string) => {
    const store = usePluginStore.getState()
    const instance = store.activePlugins.get(pluginId)
    if (!instance || instance.manifest.type !== 'audio-effect') return

    const siblings = getSortedSiblings(instance.target)
    const idx = siblings.findIndex((s) => s.manifest.id === pluginId)
    if (idx < 0 || idx >= siblings.length - 1) return

    store.swapPluginSlots(pluginId, siblings[idx + 1].manifest.id)
    rebuildEffectChain(instance.target)
  }, [])

  const handleParamChange = useCallback((pluginId: string, paramId: string, value: PluginParameterValue) => {
    usePluginStore.getState().setPluginParameter(pluginId, paramId, value)
  }, [])

  const handleToggleBypass = useCallback((pluginId: string) => {
    const store = usePluginStore.getState()
    const instance = store.activePlugins.get(pluginId)
    if (!instance) return
    recordHistory(instance.enabled ? 'Bypass plugin' : 'Enable plugin')
    store.togglePlugin(pluginId)
    if (instance.manifest.type === 'audio-effect') {
      rebuildEffectChain(instance.target)
    }
  }, [recordHistory])

  const handleResetParams = useCallback((pluginId: string) => {
    const store = usePluginStore.getState()
    const instance = store.activePlugins.get(pluginId)
    if (!instance) return
    recordHistory('Reset plugin parameters')
    for (const param of instance.manifest.parameters) {
      store.setPluginParameter(pluginId, param.id, param.defaultValue)
    }
  }, [recordHistory])

  return (
    <div className="plg-root">
      {/* Toolbar */}
      <div className="plg-toolbar">
        <button className="plg-toolbar-btn" onClick={handleImport}>
          <span className="plg-toolbar-icon plg-toolbar-icon--import" />
          IMPORT
        </button>
        <button className="plg-toolbar-btn" onClick={handleOpenFolder} title="Open plugins folder">
          <span className="plg-toolbar-icon plg-toolbar-icon--folder" />
          BROWSE
        </button>
      </div>

      {/* Plugin rack */}
      {availablePlugins.length === 0 ? (
        <div className="plg-empty">
          <div className="plg-empty-icon" />
          <span>NO MODULES LOADED</span>
        </div>
      ) : (
        <div className="plg-rack">
          {availablePlugins.map((manifest) => {
            const isActive = activePlugins.has(manifest.id)
            const instance = activePlugins.get(manifest.id)
            const isExpanded = expandedId === manifest.id && isActive

            const siblings = isActive && instance?.manifest.type === 'audio-effect'
              ? getSortedSiblings(instance.target)
              : []
            const slotIdx = siblings.findIndex((s) => s.manifest.id === manifest.id)

            return (
              <div
                key={manifest.id}
                className={`plg-module ${isActive ? 'plg-module--active' : ''} ${isExpanded ? 'plg-module--expanded' : ''}`}
              >
                {/* Module faceplate */}
                <div className="plg-faceplate">
                  {/* Status LED */}
                  <div className={`plg-led ${isActive ? 'plg-led--on' : ''}`} />

                  {/* Power toggle */}
                  <button
                    className={`plg-power ${isActive ? 'plg-power--on' : ''}`}
                    onClick={() => handleToggleActive(manifest)}
                    title={isActive ? 'Deactivate' : 'Activate'}
                  >
                    <span className="plg-power-ring" />
                  </button>

                  {/* Name + meta */}
                  <div
                    className="plg-info"
                    onClick={() => isActive && setExpandedId(isExpanded ? null : manifest.id)}
                    style={{ cursor: isActive ? 'pointer' : 'default' }}
                  >
                    <span className="plg-name">{manifest.name}</span>
                    <span className="plg-meta">
                      <span className={`plg-type plg-type--${manifest.type}`}>
                        {TYPE_LABELS[manifest.type] ?? manifest.type}
                      </span>
                      <span className="plg-version">v{manifest.version}</span>
                    </span>
                  </div>

                  {/* Expand indicator */}
                  {isActive && manifest.parameters.length > 0 && (
                    <span
                      className={`plg-expand-chevron ${isExpanded ? 'plg-expand-chevron--open' : ''}`}
                      onClick={() => setExpandedId(isExpanded ? null : manifest.id)}
                    />
                  )}

                  {/* Remove */}
                  <button
                    className="plg-remove"
                    onClick={() => handleRemove(manifest)}
                    title="Remove plugin"
                  >
                    <span className="plg-remove-x" />
                  </button>
                </div>

                {/* Signal routing strip (active audio effects only) */}
                {isActive && instance && manifest.type === 'audio-effect' && (
                  <div className="plg-routing">
                    {/* Chain position badge */}
                    {siblings.length > 1 && (
                      <span className="plg-chain-pos">{slotIdx + 1}</span>
                    )}

                    <span className="plg-routing-label">ROUTE</span>

                    <select
                      className="plg-routing-select"
                      value={instance.target}
                      onChange={(e) => handleTargetChange(manifest.id, e.target.value)}
                    >
                      <option value="master">MASTER BUS</option>
                      {sources.map((s) => (
                        <option key={s.id} value={s.id}>{s.label.toUpperCase()}</option>
                      ))}
                    </select>

                    {/* Reorder controls */}
                    {siblings.length > 1 && (
                      <div className="plg-reorder">
                        <button
                          className="plg-reorder-btn"
                          onClick={() => handleMoveUp(manifest.id)}
                          disabled={slotIdx <= 0}
                          title="Move earlier in chain"
                        >
                          <span className="plg-arrow plg-arrow--up" />
                        </button>
                        <button
                          className="plg-reorder-btn"
                          onClick={() => handleMoveDown(manifest.id)}
                          disabled={slotIdx >= siblings.length - 1}
                          title="Move later in chain"
                        >
                          <span className="plg-arrow plg-arrow--down" />
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Expanded parameter bay */}
                {isExpanded && instance && (
                  <div className="plg-params">
                    {/* Controls strip */}
                    <div className="plg-params-strip">
                      <button
                        className={`plg-bypass ${!instance.enabled ? 'plg-bypass--off' : ''}`}
                        onClick={() => handleToggleBypass(manifest.id)}
                      >
                        <span className={`plg-bypass-led ${instance.enabled ? 'plg-bypass-led--on' : ''}`} />
                        {instance.enabled ? 'ACTIVE' : 'BYPASS'}
                      </button>
                      <button className="plg-reset" onClick={() => handleResetParams(manifest.id)}>
                        DEFAULTS
                      </button>
                    </div>

                    {/* Parameter knobs */}
                    {manifest.parameters.length === 0 ? (
                      <div className="plg-no-params">No configurable parameters</div>
                    ) : (
                      <div className="plg-param-list">
                        {manifest.parameters.map((param) => (
                          <InlineParameterControl
                            key={param.id}
                            def={param}
                            value={instance.parameters[param.id] ?? param.defaultValue}
                            onChange={(val) => handleParamChange(manifest.id, param.id, val)}
                            recordHistory={recordHistory}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function getSortedSiblings(target: string) {
  const plugins = usePluginStore.getState().activePlugins
  const siblings = []
  for (const instance of plugins.values()) {
    if (instance.manifest.type === 'audio-effect' && instance.target === target && instance.enabled) {
      siblings.push(instance)
    }
  }
  return siblings.sort((a, b) => a.slot - b.slot)
}

function InlineParameterControl({
  def,
  value,
  onChange,
  recordHistory,
}: {
  def: PluginParameterDef
  value: PluginParameterValue
  onChange: (v: PluginParameterValue) => void
  recordHistory: (label: string) => void
}) {
  if (def.type === 'boolean') {
    return (
      <div className="plg-param plg-param--bool">
        <label className="plg-param-label">{def.label}</label>
        <button
          className={`plg-toggle ${value ? 'plg-toggle--on' : ''}`}
          onClick={() => {
            recordHistory(`Toggle ${def.label}`)
            onChange(!value)
          }}
        >
          <span className="plg-toggle-thumb" />
        </button>
      </div>
    )
  }

  if (def.type === 'float' || def.type === 'int') {
    const isInt = def.type === 'int'
    return (
      <div className="plg-param plg-param--range">
        <div className="plg-param-header">
          <label className="plg-param-label">{def.label}</label>
          <span className="plg-param-value">
            {isInt ? value : (value as number).toFixed(2)}
          </span>
        </div>
        <input
          type="range"
          min={def.min ?? 0}
          max={def.max ?? 1}
          step={def.step ?? (isInt ? 1 : 0.01)}
          value={value as number}
          onMouseDown={() => recordHistory(`Change ${def.label}`)}
          onChange={(e) => onChange(isInt ? parseInt(e.target.value) : parseFloat(e.target.value))}
          className="plg-slider"
        />
      </div>
    )
  }

  return null
}
