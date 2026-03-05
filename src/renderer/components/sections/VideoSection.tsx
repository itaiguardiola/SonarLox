import { useState } from 'react'
import { useAppStore } from '../../stores/useAppStore'
import { useTransportStore } from '../../stores/useTransportStore'
import { audioEngine } from '../../audio/WebAudioEngine'
import { useToast } from '../Toast'

const FRAME_RATES = [23.976, 24, 25, 29.97, 30, 60]

function getVideoDuration(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const el = document.createElement('video')
    el.preload = 'metadata'
    el.onloadedmetadata = () => { resolve(el.duration); el.src = '' }
    el.onerror = () => reject(new Error('Failed to load video metadata'))
    el.src = url
  })
}

export function VideoSection() {
  const { showToast } = useToast()
  const videoFileName = useAppStore((s) => s.videoFileName)
  const videoOffset = useAppStore((s) => s.videoOffset)
  const videoFrameRate = useAppStore((s) => s.videoFrameRate)
  const isVideoVisible = useAppStore((s) => s.isVideoVisible)
  const videoOpacity = useAppStore((s) => s.videoOpacity)
  const setVideoFile = useAppStore((s) => s.setVideoFile)
  const clearVideo = useAppStore((s) => s.clearVideo)
  const setVideoOffset = useAppStore((s) => s.setVideoOffset)
  const setVideoFrameRate = useAppStore((s) => s.setVideoFrameRate)
  const setIsVideoVisible = useAppStore((s) => s.setIsVideoVisible)
  const setVideoOpacity = useAppStore((s) => s.setVideoOpacity)
  const videoScreenVisible = useAppStore((s) => s.videoScreenVisible)
  const videoScreenLocked = useAppStore((s) => s.videoScreenLocked)
  const videoScreenScale = useAppStore((s) => s.videoScreenScale)
  const setVideoScreenVisible = useAppStore((s) => s.setVideoScreenVisible)
  const setVideoScreenLocked = useAppStore((s) => s.setVideoScreenLocked)
  const setVideoScreenScale = useAppStore((s) => s.setVideoScreenScale)

  const [extracting, setExtracting] = useState(false)

  const handleLoadVideo = async () => {
    if (!window.api?.openVideoFile) return
    const result = await window.api.openVideoFile()
    if (!result) return

    setVideoFile(result.filePath, result.name)

    // Create a silent source matching the video duration for timeline length
    await audioEngine.init()
    const videoUrl = `sonarlox-video://video?path=${encodeURIComponent(result.filePath)}`
    try {
      const duration = await getVideoDuration(videoUrl)
      if (duration > 0) {
        const sampleRate = 44100
        const frames = Math.ceil(duration * sampleRate)
        const offCtx = new OfflineAudioContext(2, frames, sampleRate)
        const silent = offCtx.createBuffer(2, frames, sampleRate)
        const { addSource, setSourceAudioFileName, setSourceLabel } = useAppStore.getState()
        addSource('file')
        const sources = useAppStore.getState().sources
        const newest = sources[sources.length - 1]
        audioEngine.createChannel(newest.id)
        audioEngine.setAudioBuffer(newest.id, silent)
        setSourceAudioFileName(newest.id, `${result.name} (ref)`)
        setSourceLabel(newest.id, 'Video Ref')
        useTransportStore.setState({ duration })
        showToast(`Video loaded: ${duration.toFixed(1)}s`, 'success')
      }
    } catch { /* duration detection failed, user can still add sources manually */ }
  }

  const handleExtractAudio = async () => {
    const filePath = useAppStore.getState().videoFilePath
    if (!filePath || extracting) return
    const videoUrl = `sonarlox-video://video?path=${encodeURIComponent(filePath)}`
    setExtracting(true)
    try {
      await audioEngine.init()
      const resp = await fetch(videoUrl)
      const buf = await resp.arrayBuffer()
      const { addSource, setSourceAudioFileName, setSourceLabel } = useAppStore.getState()
      addSource('file')
      const sources = useAppStore.getState().sources
      const newest = sources[sources.length - 1]
      audioEngine.createChannel(newest.id)
      await audioEngine.loadFile(newest.id, buf)
      setSourceAudioFileName(newest.id, `${useAppStore.getState().videoFileName} (audio)`)
      setSourceLabel(newest.id, 'Video Audio')
      useTransportStore.setState({ duration: audioEngine.getDuration() })
      showToast('Audio extracted from video', 'success')
    } catch {
      showToast('No audio track found in video', 'error')
    } finally {
      setExtracting(false)
    }
  }

  const offsetSign = videoOffset >= 0 ? '+' : ''

  return (
    <div className="vs-root">
      <span className="section-label">Video Sync</span>

      {!videoFileName ? (
        <button className="video-section-load-btn" onClick={handleLoadVideo}>
          Load Video
        </button>
      ) : (
        <>
          {/* Loaded file well */}
          <div className="video-section-well">
            <div className="video-section-icon" />
            <span className="video-section-filename" title={videoFileName}>
              {videoFileName}
            </span>
            <button
              className="video-section-unload"
              onClick={clearVideo}
              title="Unload video"
            >
              X
            </button>
          </div>

          {/* Extract audio from video */}
          <button
            className={`vs-extract-btn ${extracting ? 'vs-extract-btn--busy' : ''}`}
            onClick={handleExtractAudio}
            disabled={extracting}
          >
            <span className="vs-extract-icon" />
            {extracting ? 'Extracting...' : 'Extract Audio'}
          </button>

          {/* TC Offset */}
          <div className="vs-control-group">
            <div className="vs-control-row">
              <span className="vs-label">TC Offset</span>
              <span className="slider-value">{offsetSign}{videoOffset.toFixed(1)}s</span>
            </div>
            <input
              type="range"
              min={-300}
              max={300}
              step={0.1}
              value={videoOffset}
              onChange={(e) => setVideoOffset(parseFloat(e.target.value))}
            />
          </div>

          {/* Frame Rate + Visibility row */}
          <div className="vs-toggle-row">
            <div className="vs-toggle-group" style={{ flex: 1 }}>
              <span className="vs-label">FPS</span>
              <select
                className="video-section-select"
                value={videoFrameRate}
                onChange={(e) => setVideoFrameRate(parseFloat(e.target.value))}
              >
                {FRAME_RATES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <div className="vs-toggle-group">
              <span className="vs-label">VIS</span>
              <div
                className={`video-section-toggle ${isVideoVisible ? 'video-section-toggle--on' : ''}`}
                onClick={() => setIsVideoVisible(!isVideoVisible)}
                role="switch"
                aria-checked={isVideoVisible}
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') setIsVideoVisible(!isVideoVisible) }}
              />
            </div>
          </div>

          {/* Opacity */}
          <div className="vs-control-group">
            <div className="vs-control-row">
              <span className="vs-label">Opacity</span>
              <span className="slider-value">{(videoOpacity * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={videoOpacity}
              onChange={(e) => setVideoOpacity(parseFloat(e.target.value))}
            />
          </div>

          {/* 3D Screen controls */}
          <div className="vs-toggle-row">
            <div className="vs-toggle-group">
              <span className="vs-label">3D</span>
              <div
                className={`video-section-toggle ${videoScreenVisible ? 'video-section-toggle--on' : ''}`}
                onClick={() => setVideoScreenVisible(!videoScreenVisible)}
                role="switch"
                aria-checked={videoScreenVisible}
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') setVideoScreenVisible(!videoScreenVisible) }}
              />
            </div>

            <div className="vs-toggle-group">
              <span className="vs-label">LOCK</span>
              <div
                className={`video-section-toggle ${videoScreenLocked ? 'video-section-toggle--on' : ''}`}
                onClick={() => setVideoScreenLocked(!videoScreenLocked)}
                role="switch"
                aria-checked={videoScreenLocked}
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') setVideoScreenLocked(!videoScreenLocked) }}
                style={videoScreenLocked ? { borderColor: 'var(--accent-amber-dim)' } : undefined}
              />
            </div>
          </div>

          {/* Screen scale */}
          <div className="vs-control-group">
            <div className="vs-control-row">
              <span className="vs-label">Screen Size</span>
              <span className="slider-value">{videoScreenScale.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              step={0.5}
              value={videoScreenScale}
              onChange={(e) => setVideoScreenScale(parseFloat(e.target.value))}
            />
          </div>
        </>
      )}
    </div>
  )
}
