import { useRef, useState, useCallback, useEffect } from 'react'
import { useAppStore } from '../stores/useAppStore'
import { useTransportStore } from '../stores/useTransportStore'
import { useVideoSync } from '../hooks/useVideoSync'
import { secondsToTimecode } from '../utils/timecode'
import { setVideoElement } from '../video/videoElementRef'

export function VideoPanel() {
  const videoFilePath = useAppStore((s) => s.videoFilePath)
  const videoFileName = useAppStore((s) => s.videoFileName)
  const isVideoVisible = useAppStore((s) => s.isVideoVisible)
  const videoOpacity = useAppStore((s) => s.videoOpacity)
  const videoFrameRate = useAppStore((s) => s.videoFrameRate)
  const videoOffset = useAppStore((s) => s.videoOffset)

  const videoRef = useRef<HTMLVideoElement>(null)
  const [collapsed, setCollapsed] = useState(false)

  useVideoSync(videoRef)

  // Share the video element with the 3D scene
  useEffect(() => {
    const el = videoRef.current
    if (el && videoFilePath) {
      setVideoElement(el)
    }
    return () => setVideoElement(null)
  }, [videoFilePath])

  const videoTime = useTransportStore((s) => Math.max(0, s.playheadPosition - videoOffset))
  const isPlaying = useTransportStore((s) => s.isPlaying)

  const frameDuration = 1 / videoFrameRate

  const stepFrame = useCallback((direction: 1 | -1) => {
    const video = videoRef.current
    if (!video || isPlaying) return
    const newTime = video.currentTime + direction * frameDuration
    video.currentTime = Math.max(0, newTime)
    const offset = useAppStore.getState().videoOffset
    useTransportStore.getState().seek(Math.max(0, newTime + offset))
  }, [isPlaying, frameDuration])

  if (!videoFilePath || !isVideoVisible) return null

  const videoSrc = `sonarlox-video://video?path=${encodeURIComponent(videoFilePath)}`

  // Split timecode into segments for styled rendering
  const tc = secondsToTimecode(videoTime, videoFrameRate)
  const tcParts = tc.split(':')

  const offsetSign = videoOffset >= 0 ? '+' : ''
  const offsetDisplay = `${offsetSign}${videoOffset.toFixed(1)}s`

  return (
    <div className={`video-panel ${collapsed ? 'video-panel--collapsed' : ''}`}>
      {/* Monitor top bar */}
      <div className="video-panel-bar">
        <div
          className={`video-panel-sync-led ${isPlaying ? 'video-panel-sync-led--active' : ''}`}
          title={isPlaying ? 'Synced' : 'Idle'}
        />
        <span className="video-panel-label">VIDEO</span>

        <span className="video-panel-timecode">
          {tcParts[0]}<span className="tc-sep">:</span>{tcParts[1]}<span className="tc-sep">:</span>{tcParts[2]}<span className="tc-sep">:</span>{tcParts[3]}
        </span>

        <span className="video-panel-fps">{videoFrameRate}fps</span>

        <span className="video-panel-spacer" />

        {!isPlaying && !collapsed && (
          <div className="video-panel-framestep">
            <button
              className="tl-btn"
              onClick={() => stepFrame(-1)}
              title="Previous frame"
            >
              &#9664;
            </button>
            <button
              className="tl-btn"
              onClick={() => stepFrame(1)}
              title="Next frame"
            >
              &#9654;
            </button>
          </div>
        )}

        <button
          className="tl-btn"
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? 'Expand video' : 'Collapse video'}
          style={{ fontSize: 7 }}
        >
          {collapsed ? '\u25BC' : '\u25B2'}
        </button>
      </div>

      {/* Collapsible video content */}
      <div className="video-panel-content-wrap">
        <div className="video-panel-content">
          <video
            ref={videoRef}
            src={videoSrc}
            muted
            playsInline
            preload="auto"
            style={{ opacity: videoOpacity }}
          />

          {/* CRT scanline overlay */}
          <div className="video-panel-scanlines" />

          {/* Vignette */}
          <div className="video-panel-vignette" />

          {/* Broadcast crop marks (visible on hover) */}
          <div className="video-panel-cropmarks">
            <div className="video-panel-cropmark-tr" />
            <div className="video-panel-cropmark-bl" />
          </div>
        </div>

        {/* Bottom bezel */}
        <div className="video-panel-bezel">
          <span className="video-panel-offset">
            OFFSET <span className="video-panel-offset-value">{offsetDisplay}</span>
          </span>
          <span className="video-panel-filename" title={videoFileName ?? ''}>
            {videoFileName}
          </span>
        </div>
      </div>
    </div>
  )
}
