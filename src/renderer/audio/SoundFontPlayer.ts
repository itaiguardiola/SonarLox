import type { MidiTrackData } from './MidiParser'

let sfData: ArrayBuffer | null = null
let sfName: string | null = null
let wasmReady = false

async function ensureWasm(): Promise<void> {
  if (wasmReady) return

  // Dynamically load the FluidSynth WASM module from the public dir
  await new Promise<void>((resolve, reject) => {
    // Check if already loaded
    if (typeof (window as unknown as Record<string, unknown>).Module !== 'undefined') {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = './libfluidsynth-2.4.6.js'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load FluidSynth WASM'))
    document.head.appendChild(script)
  })

  const JSSynth = await import('js-synthesizer')
  await JSSynth.waitForReady()
  wasmReady = true
}

export async function loadSoundFont(data: ArrayBuffer, name: string): Promise<void> {
  await ensureWasm()
  sfData = data
  sfName = name
}

export function unloadSoundFont(): void {
  sfData = null
  sfName = null
}

export function isLoaded(): boolean {
  return sfData !== null
}

export function getSoundFontName(): string | null {
  return sfName
}

export async function renderMidiTrackWithSoundFont(
  track: MidiTrackData,
  sampleRate: number = 44100
): Promise<AudioBuffer> {
  if (!sfData) throw new Error('No SoundFont loaded')
  await ensureWasm()

  const JSSynth = await import('js-synthesizer')
  const synth = new JSSynth.Synthesizer()
  synth.init(sampleRate)

  const sfontId = await synth.loadSFont(sfData)

  // Set up the channel
  const channel = track.channel === 9 ? 9 : 0
  if (channel === 9) {
    synth.midiSetChannelType(channel, true)
  }
  synth.midiProgramSelect(channel, sfontId, channel === 9 ? 128 : 0, track.program)

  // Calculate total duration with release tail
  const tailTime = 1.0
  const totalDuration = track.duration + tailTime
  const totalFrames = Math.ceil(totalDuration * sampleRate)

  // Sort notes by time
  const notes = [...track.notes].sort((a, b) => a.time - b.time)

  // Build a timeline of events: noteOn and noteOff
  interface MidiEvent {
    time: number
    type: 'on' | 'off'
    midi: number
    velocity: number
  }

  const events: MidiEvent[] = []
  for (const note of notes) {
    events.push({ time: note.time, type: 'on', midi: note.midi, velocity: Math.round(note.velocity * 127) })
    events.push({ time: note.time + note.duration, type: 'off', midi: note.midi, velocity: 0 })
  }
  events.sort((a, b) => a.time - b.time || (a.type === 'off' ? -1 : 1))

  // Render in chunks, dispatching MIDI events at the right time
  const chunkSize = 512
  const left = new Float32Array(totalFrames)
  const right = new Float32Array(totalFrames)
  const chunkLeft = new Float32Array(chunkSize)
  const chunkRight = new Float32Array(chunkSize)

  let eventIdx = 0
  let framePos = 0

  while (framePos < totalFrames) {
    const currentTime = framePos / sampleRate

    // Dispatch all events up to current time
    while (eventIdx < events.length && events[eventIdx].time <= currentTime) {
      const ev = events[eventIdx]
      if (ev.type === 'on') {
        synth.midiNoteOn(channel, ev.midi, ev.velocity)
      } else {
        synth.midiNoteOff(channel, ev.midi)
      }
      eventIdx++
    }

    const framesToRender = Math.min(chunkSize, totalFrames - framePos)

    if (framesToRender < chunkSize) {
      // Last partial chunk
      const partialLeft = new Float32Array(framesToRender)
      const partialRight = new Float32Array(framesToRender)
      synth.render([partialLeft, partialRight])
      left.set(partialLeft, framePos)
      right.set(partialRight, framePos)
    } else {
      synth.render([chunkLeft, chunkRight])
      left.set(chunkLeft, framePos)
      right.set(chunkRight, framePos)
    }

    framePos += framesToRender
  }

  synth.close()

  // Create AudioBuffer
  const audioCtx = new OfflineAudioContext(2, totalFrames, sampleRate)
  const audioBuffer = audioCtx.createBuffer(2, totalFrames, sampleRate)
  audioBuffer.getChannelData(0).set(left)
  audioBuffer.getChannelData(1).set(right)

  return audioBuffer
}
