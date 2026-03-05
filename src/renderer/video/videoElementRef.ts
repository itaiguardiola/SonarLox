let videoElement: HTMLVideoElement | null = null

export function setVideoElement(el: HTMLVideoElement | null): void {
  videoElement = el
}

export function getVideoElement(): HTMLVideoElement | null {
  return videoElement
}
