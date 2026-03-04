import { encodeWav } from './encodeWav'

export async function exportBinauralWav(
  audioBuffer: AudioBuffer,
  position: [number, number, number],
  volume: number
): Promise<ArrayBuffer> {
  const sampleRate = 44100
  const length = Math.ceil(audioBuffer.duration * sampleRate)
  const offlineCtx = new OfflineAudioContext(2, length, sampleRate)

  const source = offlineCtx.createBufferSource()
  source.buffer = audioBuffer

  const gainNode = offlineCtx.createGain()
  gainNode.gain.value = volume

  const pannerNode = offlineCtx.createPanner()
  pannerNode.panningModel = 'HRTF'
  pannerNode.distanceModel = 'inverse'
  pannerNode.refDistance = 1
  pannerNode.maxDistance = 50
  pannerNode.rolloffFactor = 1
  pannerNode.positionX.value = position[0]
  pannerNode.positionY.value = position[1]
  pannerNode.positionZ.value = position[2]

  source.connect(gainNode)
  gainNode.connect(pannerNode)
  pannerNode.connect(offlineCtx.destination)

  source.start()
  const rendered = await offlineCtx.startRendering()
  return encodeWav(rendered)
}

interface ExportSource {
  audioBuffer: AudioBuffer
  position: [number, number, number]
  volume: number
}

export async function exportMixedBinauralWav(
  sources: ExportSource[]
): Promise<ArrayBuffer> {
  if (sources.length === 0) throw new Error('No sources to export')

  const sampleRate = 44100
  const maxDuration = Math.max(...sources.map((s) => s.audioBuffer.duration))
  const length = Math.ceil(maxDuration * sampleRate)
  const offlineCtx = new OfflineAudioContext(2, length, sampleRate)

  for (const src of sources) {
    const source = offlineCtx.createBufferSource()
    source.buffer = src.audioBuffer

    const gainNode = offlineCtx.createGain()
    gainNode.gain.value = src.volume

    const pannerNode = offlineCtx.createPanner()
    pannerNode.panningModel = 'HRTF'
    pannerNode.distanceModel = 'inverse'
    pannerNode.refDistance = 1
    pannerNode.maxDistance = 50
    pannerNode.rolloffFactor = 1
    pannerNode.positionX.value = src.position[0]
    pannerNode.positionY.value = src.position[1]
    pannerNode.positionZ.value = src.position[2]

    source.connect(gainNode)
    gainNode.connect(pannerNode)
    pannerNode.connect(offlineCtx.destination)

    source.start()
  }

  const rendered = await offlineCtx.startRendering()
  return encodeWav(rendered)
}
