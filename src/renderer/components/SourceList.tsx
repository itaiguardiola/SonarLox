import { useState, useRef, useEffect } from 'react'
import { useAppStore } from '../stores/useAppStore'
import { audioEngine } from '../audio/WebAudioEngine'
import { parseMidi } from '../audio/MidiParser'
import { renderMidiTrack } from '../audio/MidiSynth'
import { isLoaded as isSoundFontLoaded, renderMidiTrackWithSoundFont } from '../audio/SoundFontPlayer'
import { setTrack, deleteTrack } from '../audio/midiTrackCache'
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
  const setSourceLabel = useAppStore((s) => s.setSourceLabel)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const editInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus()
      editInputRef.current.select()
    }
  }, [editingId])

  const startRename = (id: string, currentLabel: string) => {
    setEditingId(id)
    setEditValue(currentLabel)
  }

  const commitRename = () => {
    if (editingId && editValue.trim()) {
      setSourceLabel(editingId, editValue.trim())
    }
    setEditingId(null)
  }

  const handleAdd = async (type: SourceType) => {
    await audioEngine.init()
    addSource(type)
    const newSources = useAppStore.getState().sources
    const newest = newSources[newSources.length - 1]
    audioEngine.createChannel(newest.id)
  }

  const handleRemove = (id: string) => {
    audioEngine.removeChannel(id)
    deleteTrack(id)
    removeSource(id)
  }

  const handleMuteToggle = (id: string, currentMuted: boolean) => {
    setSourceMuted(id, !currentMuted)
  }

  const handleSoloToggle = (id: string, currentSoloed: boolean) => {
    setSourceSoloed(id, !currentSoloed)
  }

  const [midiProgress, setMidiProgress] = useState<{ current: number; total: number; trackName: string } | null>(null)

  const handleLoadMidi = async () => {
    if (!window.api) return
    try {
      const result = await window.api.openMidiFile()
      if (!result) return

      setMidiProgress({ current: 0, total: 0, trackName: 'Parsing...' })
      await audioEngine.init()

      const tracks = parseMidi(result.buffer)
      const remaining = MAX_SOURCES - useAppStore.getState().sources.length
      const tracksToLoad = tracks.slice(0, remaining)

      for (let i = 0; i < tracksToLoad.length; i++) {
        const track = tracksToLoad[i]
        setMidiProgress({ current: i + 1, total: tracksToLoad.length, trackName: track.name || `Track ${i + 1}` })

        addSource('midi-track')
        const newSources = useAppStore.getState().sources
        const newest = newSources[newSources.length - 1]
        audioEngine.createChannel(newest.id)

        // Cache track data for re-rendering when SoundFont changes
        setTrack(newest.id, track)

        // Yield to UI before heavy render
        await new Promise((r) => setTimeout(r, 0))
        const buffer = isSoundFontLoaded()
          ? await renderMidiTrackWithSoundFont(track)
          : await renderMidiTrack(track)
        audioEngine.setAudioBuffer(newest.id, buffer)
        useAppStore.getState().setSourceAudioFileName(newest.id, track.name)
      }
    } catch (err) {
      console.error('Failed to load MIDI:', err)
    } finally {
      setMidiProgress(null)
    }
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
            {editingId === source.id ? (
              <input
                ref={editInputRef}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename()
                  if (e.key === 'Escape') setEditingId(null)
                  e.stopPropagation()
                }}
                onClick={(e) => e.stopPropagation()}
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--text-bright)',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--accent-teal, #00cccc)',
                  borderRadius: 2,
                  padding: '1px 4px',
                  outline: 'none',
                  fontFamily: 'inherit',
                }}
              />
            ) : (
              <span
                onDoubleClick={(e) => {
                  e.stopPropagation()
                  startRename(source.id, source.label)
                }}
                title="Double-click to rename"
                style={{
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontSize: 12,
                  fontWeight: isSelected ? 500 : 400,
                  color: isSelected ? 'var(--text-bright)' : 'var(--text-primary)',
                  cursor: 'text',
                }}
              >
                {source.label}
                {source.audioFileName && (
                  <span style={{ color: 'var(--text-muted)', marginLeft: 6, fontSize: 11 }}>
                    {source.audioFileName}
                  </span>
                )}
              </span>
            )}
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              color: 'var(--text-muted)',
              padding: '1px 4px',
              border: '1px solid var(--border-subtle)',
              borderRadius: 2,
              lineHeight: 1.2,
            }}>
              {source.sourceType === 'file' ? 'FILE' : source.sourceType === 'tone' ? 'TONE' : 'MIDI'}
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

      {midiProgress && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          padding: '6px 8px',
          background: 'var(--bg-elevated)',
          borderRadius: 4,
          border: '1px solid var(--border-subtle)',
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--text-secondary)',
            }}>
              Rendering MIDI
            </span>
            {midiProgress.total > 0 && (
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: 'var(--text-muted)',
              }}>
                {midiProgress.current}/{midiProgress.total}
              </span>
            )}
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {midiProgress.trackName}
          </div>
          {midiProgress.total > 0 && (
            <div style={{
              height: 3,
              background: 'var(--bg-sunken, #1a1a2e)',
              borderRadius: 2,
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${(midiProgress.current / midiProgress.total) * 100}%`,
                background: 'var(--accent-teal, #00cccc)',
                borderRadius: 2,
                transition: 'width 0.2s ease',
              }} />
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 5 }}>
        <button
          className="btn"
          onClick={() => handleAdd('file')}
          disabled={atMax || !!midiProgress}
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
          disabled={atMax || !!midiProgress}
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
        <button
          className="btn"
          onClick={handleLoadMidi}
          disabled={atMax || !!midiProgress}
          style={{
            flex: 1,
            fontSize: 11,
            padding: '5px 10px',
            textAlign: 'center',
            borderStyle: 'dashed',
            color: atMax ? 'var(--text-muted)' : 'var(--text-secondary)',
          }}
        >
          + MIDI
        </button>
      </div>
    </div>
  )
}
