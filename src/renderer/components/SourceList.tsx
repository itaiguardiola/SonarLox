import { useAppStore } from '../stores/useAppStore'
import { audioEngine } from '../audio/AudioEngine'
import { MAX_SOURCES } from '../types'

export function SourceList() {
  const sources = useAppStore((s) => s.sources)
  const selectedSourceId = useAppStore((s) => s.selectedSourceId)
  const selectSource = useAppStore((s) => s.selectSource)
  const addSource = useAppStore((s) => s.addSource)
  const removeSource = useAppStore((s) => s.removeSource)
  const setSourceMuted = useAppStore((s) => s.setSourceMuted)

  const handleAdd = async () => {
    await audioEngine.init()
    addSource()
    const newSources = useAppStore.getState().sources
    const newest = newSources[newSources.length - 1]
    audioEngine.createChannel(newest.id)
  }

  const handleRemove = (id: string) => {
    audioEngine.removeChannel(id)
    removeSource(id)
  }

  const handleMuteToggle = (id: string, currentMuted: boolean) => {
    setSourceMuted(id, !currentMuted)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="section-label" style={{ paddingBottom: 0 }}>
          Sources
        </span>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--text-muted)',
          }}
        >
          {sources.length}/{MAX_SOURCES}
        </span>
      </div>

      {sources.map((source) => {
        const isSelected = source.id === selectedSourceId
        return (
          <div
            key={source.id}
            className={`source-row ${isSelected ? 'source-row--selected' : ''}`}
            onClick={() => selectSource(source.id)}
          >
            <span
              className="source-led"
              style={{
                background: source.color,
                boxShadow: isSelected
                  ? `0 0 8px ${source.color}88, 0 0 3px ${source.color}`
                  : `0 0 4px ${source.color}44`,
              }}
            />
            <span
              style={{
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontSize: 12,
                fontWeight: isSelected ? 500 : 400,
                color: isSelected ? 'var(--text-bright)' : 'var(--text-primary)',
              }}
            >
              {source.label}
              {source.audioFileName && (
                <span style={{ color: 'var(--text-muted)', marginLeft: 6, fontSize: 11 }}>
                  {source.audioFileName}
                </span>
              )}
            </span>
            <button
              className={`btn-icon ${source.isMuted ? 'btn-icon--muted' : ''}`}
              onClick={(e) => {
                e.stopPropagation()
                handleMuteToggle(source.id, source.isMuted)
              }}
              title={source.isMuted ? 'Unmute' : 'Mute'}
            >
              {source.isMuted ? 'M' : 'S'}
            </button>
            {sources.length > 1 && (
              <button
                className="btn-icon"
                onClick={(e) => {
                  e.stopPropagation()
                  handleRemove(source.id)
                }}
                title="Remove source"
              >
                x
              </button>
            )}
          </div>
        )
      })}

      <button
        className="btn"
        onClick={handleAdd}
        disabled={sources.length >= MAX_SOURCES}
        style={{
          fontSize: 11,
          padding: '5px 12px',
          textAlign: 'center',
          borderStyle: 'dashed',
          color: sources.length >= MAX_SOURCES
            ? 'var(--text-muted)'
            : 'var(--text-secondary)',
        }}
      >
        + Add Source
      </button>
    </div>
  )
}
