import { useState, useEffect } from 'react'
import { VideoScreen } from './VideoScreen'
import { getVideoElement } from '../video/videoElementRef'
import { useAppStore } from '../stores/useAppStore'

export function VideoScreenBridge() {
  const hasVideo = useAppStore((s) => s.videoFilePath !== null)
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null)

  useEffect(() => {
    if (!hasVideo) {
      setVideoEl(null) // eslint-disable-line react-hooks/set-state-in-effect -- intentional clear on video removal
      return
    }
    // Poll for the video element AND wait until it has loaded data
    let cancelled = false
    const check = () => {
      if (cancelled) return
      const el = getVideoElement()
      if (el && el.readyState >= 2) {
        setVideoEl(el)
      } else {
        requestAnimationFrame(check)
      }
    }
    check()
    return () => { cancelled = true }
  }, [hasVideo])

  if (!videoEl) return null
  return <VideoScreen videoElement={videoEl} />
}
