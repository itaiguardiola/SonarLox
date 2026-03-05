export function secondsToTimecode(seconds: number, frameRate: number): string {
  const totalFrames = Math.floor(Math.abs(seconds) * frameRate)
  const sign = seconds < 0 ? '-' : ''
  const ff = totalFrames % Math.round(frameRate)
  const totalSecs = Math.floor(totalFrames / Math.round(frameRate))
  const ss = totalSecs % 60
  const totalMins = Math.floor(totalSecs / 60)
  const mm = totalMins % 60
  const hh = Math.floor(totalMins / 60)

  return `${sign}${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}:${String(ff).padStart(2, '0')}`
}

export function timecodeToSeconds(timecode: string, frameRate: number): number {
  const negative = timecode.startsWith('-')
  const clean = timecode.replace(/^-/, '')
  const parts = clean.split(':').map(Number)
  if (parts.length !== 4 || parts.some(isNaN)) return 0

  const [hh, mm, ss, ff] = parts
  const totalSeconds = hh * 3600 + mm * 60 + ss + ff / Math.round(frameRate)
  return negative ? -totalSeconds : totalSeconds
}
