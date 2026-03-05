import { useAppStore } from '../stores/useAppStore'
import { audioEngine } from '../audio/WebAudioEngine'
import { MAX_SOURCES } from '../types'
import type { SourceType } from '../types'

export function SourceList() {
  const sources = useAppStore((s) => s.sources)
  const selectedSourceId = useAppStore((s) => s.selectedSourceId)
  const selectSource = useAppStore((s) => s.selectSource)
  const addSource = useAppStore((s) => s.addSource)
  const removeSource = useAppStore((s) => s.removeSource)
  const setSourceMuted = useAppStore((s) => s.setSourceMuted)
  const setSourceSoloed = useAppStore((s) => s.setSourceSoloed)

  const handleAdd = async (type: SourceType) => {
    await audioEngine.init()
    addSource(type)
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

  const handleSoloToggle = (id: string, currentSoloed: boolean) => {
    setSourceSoloed(id, !currentSoloed)
  }

  const atMax = sources.length >= MAX_SOURCES

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
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              color: 'var(--text-muted)',
              padding: '1px 4px',
              border: '1px solid var(--border-subtle)',
              borderRadius: 2,
              lineHeight: 1.2,
            }}>
              {source.sourceType === 'file' ? 'FILE' : 'TONE'}
            </span>
            <button
              className={`btn-icon ${source.isMuted ? 'btn-icon--muted' : ''}`}
              onClick={(e) => {
                e.stopPropagation()
                handleMuteToggle(source.id, source.isMuted)
              }}
              title={source.isMuted ? 'Unmute' : 'Mute'}
            >
              M
            </button>
            <button
              className={`btn-icon ${source.isSoloed ? 'btn-icon--soloed' : ''}`}
              onClick={(e) => {
                e.stopPropagation()
                handleSoloToggle(source.id, source.isSoloed)
              }}
              title={source.isSoloed ? 'Unsolo' : 'Solo'}
            >
              S
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

      <div style={{ display: 'flex', gap: 5 }}>
        <button
          className="btn"
          onClick={() => handleAdd('file')}
          disabled={atMax}
          style={{
            flex: 1,
            fontSize: 11,
            padding: '5px 10px',
            textAlign: 'center',
            borderStyle: 'dashed',
            color: atMax ? 'var(--text-muted)' : 'var(--text-secondary)',
          }}
        >
          + File
        </button>
        <button
          className="btn"
          onClick={() => handleAdd('tone')}
          disabled={atMax}
          style={{
            flex: 1,
            fontSize: 11,
            padding: '5px 10px',
            textAlign: 'center',
            borderStyle: 'dashed',
            color: atMax ? 'var(--text-muted)' : 'var(--text-secondary)',
          }}
        >
          + Tone
        </button>
      </div>
    </div>
  )
}
