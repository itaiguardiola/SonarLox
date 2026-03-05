import { useState, useCallback } from 'react'
import { useAppStore } from '../stores/useAppStore'
import { usePluginStore } from '../plugins/usePluginStore'
import { PluginInstance, PluginParameterDef, PluginParameterValue } from '../plugins/types'
import { SourceId } from '../types'

interface PluginEditorProps {
  instance: PluginInstance
  onClose: () => void
}

/**
 * Rich editor overlay for plugin parameters.
 * Supports sliders, toggles, and file pickers.
 */
export function PluginEditor({ instance, onClose }: PluginEditorProps) {
  const { manifest, parameters, plugin, target, enabled } = instance
  const setPluginParameter = usePluginStore((s) => s.setPluginParameter)
  const togglePlugin = usePluginStore((s) => s.togglePlugin)
  const recordHistory = useAppStore((s) => s.recordHistory)

  const handleParamChange = useCallback((id: string, value: PluginParameterValue) => {
    setPluginParameter(manifest.id, id, value)
  }, [manifest.id, setPluginParameter])

  const handleReset = useCallback(() => {
    recordHistory('Reset plugin parameters')
    manifest.parameters.forEach((param) => {
      handleParamChange(param.id, param.defaultValue)
    })
  }, [manifest.parameters, handleParamChange, recordHistory])

  return (
    <div className="export-overlay" style={{ zIndex: 2000 }}>
      <div className="export-dialog" style={{ width: 400, maxWidth: '90vw' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h3 className="section-label" style={{ margin: 0, color: 'var(--text-bright)' }}>{manifest.name}</h3>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>v{manifest.version} by {manifest.author}</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
             <button 
              className={`btn ${!enabled ? 'btn--muted' : ''}`} 
              onClick={() => {
                recordHistory(enabled ? 'Bypass plugin' : 'Enable plugin')
                togglePlugin(manifest.id)
              }}
              style={{ fontSize: 10, padding: '4px 8px' }}
            >
              {enabled ? 'ENABLED' : 'BYPASSED'}
            </button>
            <button className="btn-icon" onClick={onClose} style={{ fontSize: 16 }}>×</button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24, maxHeight: '60vh', overflowY: 'auto', paddingRight: 4 }}>
          {manifest.parameters.map((param) => (
            <ParameterControl
              key={param.id}
              def={param}
              value={parameters[param.id] ?? param.defaultValue}
              onChange={(val) => handleParamChange(param.id, val)}
              recordHistory={recordHistory}
            />
          ))}
          {manifest.parameters.length === 0 && (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 11 }}>
              No configurable parameters
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button className="btn" onClick={handleReset} style={{ fontSize: 11 }}>Reset Defaults</button>
          <button className="btn btn--accent" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  )
}

function ParameterControl({ 
  def, 
  value, 
  onChange, 
  recordHistory 
}: { 
  def: PluginParameterDef, 
  value: PluginParameterValue, 
  onChange: (v: PluginParameterValue) => void,
  recordHistory: (label: string) => void
}) {
  if (def.type === 'boolean') {
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <label style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{def.label}</label>
        <input 
          type="checkbox" 
          checked={value as boolean} 
          onClick={() => recordHistory(`Toggle ${def.label}`)}
          onChange={(e) => onChange(e.target.checked)}
        />
      </div>
    )
  }

  if (def.type === 'float' || def.type === 'int') {
    const isInt = def.type === 'int'
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <label style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{def.label}</label>
          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>
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
          style={{ width: '100%' }}
        />
      </div>
    )
  }

  return null
}
