import type { MidiTrackData } from './MidiParser'

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

interface Envelope {
  attack: number
  decay: number
  sustain: number
  release: number
}

interface PatchConfig {
  waveform: OscillatorType
  envelope: Envelope
}

function getPatch(program: number, channel: number): PatchConfig {
  // Channel 10 (9 in 0-indexed) is drums
  if (channel === 9) {
    return {
      waveform: 'square',
      envelope: { attack: 0.001, decay: 0.05, sustain: 0.1, release: 0.05 },
    }
  }

  // Piano / chromatic percussion (0-15)
  if (program < 16) {
    return {
      waveform: 'triangle',
      envelope: { attack: 0.01, decay: 0.15, sustain: 0.4, release: 0.3 },
    }
  }
  // Organ (16-23)
  if (program < 24) {
    return {
      waveform: 'sine',
      envelope: { attack: 0.02, decay: 0.1, sustain: 0.8, release: 0.2 },
    }
  }
  // Guitar (24-31)
  if (program < 32) {
    return {
      waveform: 'triangle',
      envelope: { attack: 0.005, decay: 0.2, sustain: 0.3, release: 0.2 },
    }
  }
  // Bass (32-39)
  if (program < 40) {
    return {
      waveform: 'sine',
      envelope: { attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.2 },
    }
  }
  // Strings (40-47)
  if (program < 48) {
    return {
      waveform: 'sawtooth',
      envelope: { attack: 0.08, decay: 0.2, sustain: 0.7, release: 0.4 },
    }
  }
  // Ensemble / pads (48-55)
  if (program < 56) {
    return {
      waveform: 'sawtooth',
      envelope: { attack: 0.1, decay: 0.2, sustain: 0.7, release: 0.5 },
    }
  }
  // Brass (56-63)
  if (program < 64) {
    return {
      waveform: 'sawtooth',
      envelope: { attack: 0.03, decay: 0.1, sustain: 0.6, release: 0.2 },
    }
  }
  // Reed / pipe (64-79)
  if (program < 80) {
    return {
      waveform: 'square',
      envelope: { attack: 0.02, decay: 0.1, sustain: 0.6, release: 0.2 },
    }
  }
  // Synth lead (80-87)
  if (program < 88) {
    return {
      waveform: 'sawtooth',
      envelope: { attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.2 },
    }
  }
  // Synth pad (88-95)
  if (program < 96) {
    return {
      waveform: 'sine',
      envelope: { attack: 0.15, decay: 0.2, sustain: 0.8, release: 0.5 },
    }
  }

  // Default
  return {
    waveform: 'square',
    envelope: { attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.3 },
  }
}

function renderDrumNote(
  ctx: OfflineAudioContext,
  midi: number,
  time: number,
  duration: number,
  velocity: number
): void {
  // Use filtered noise burst for drums
  const burstLength = Math.min(duration + 0.05, 0.15)
  const sampleCount = Math.ceil(burstLength * ctx.sampleRate)
  const noiseBuffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate)
  const data = noiseBuffer.getChannelData(0)
  for (let i = 0; i < sampleCount; i++) {
    data[i] = Math.random() * 2 - 1
  }

  const source = ctx.createBufferSource()
  source.buffer = noiseBuffer

  // Pitch the noise filter based on MIDI note
  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = midiToFreq(midi)
  filter.Q.value = 1.5

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0, time)
  gain.gain.linearRampToValueAtTime(velocity * 0.7, time + 0.001)
  gain.gain.exponentialRampToValueAtTime(0.001, time + burstLength)

  source.connect(filter)
  filter.connect(gain)
  gain.connect(ctx.destination)

  source.start(time)
  source.stop(time + burstLength)
}

function renderOscNote(
  ctx: OfflineAudioContext,
  midi: number,
  time: number,
  duration: number,
  velocity: number,
  patch: PatchConfig
): void {
  const osc = ctx.createOscillator()
  osc.type = patch.waveform
  osc.frequency.value = midiToFreq(midi)

  const gain = ctx.createGain()
  const env = patch.envelope
  const noteEnd = time + duration
  const releaseEnd = noteEnd + env.release

  // Attack
  gain.gain.setValueAtTime(0, time)
  gain.gain.linearRampToValueAtTime(velocity * 0.5, time + env.attack)
  // Decay to sustain
  gain.gain.linearRampToValueAtTime(
    velocity * 0.5 * env.sustain,
    time + env.attack + env.decay
  )
  // Release
  gain.gain.setValueAtTime(velocity * 0.5 * env.sustain, noteEnd)
  gain.gain.linearRampToValueAtTime(0, releaseEnd)

  osc.connect(gain)
  gain.connect(ctx.destination)

  osc.start(time)
  osc.stop(releaseEnd + 0.01)
}

export async function renderMidiTrack(
  track: MidiTrackData,
  sampleRate: number = 44100
): Promise<AudioBuffer> {
  const patch = getPatch(track.program, track.channel)
  const isDrum = track.channel === 9
  const tailTime = isDrum ? 0.2 : patch.envelope.release + 0.1
  const totalDuration = track.duration + tailTime

  // Minimum 0.1s buffer
  const length = Math.max(Math.ceil(totalDuration * sampleRate), sampleRate * 0.1)
  const ctx = new OfflineAudioContext(2, length, sampleRate)

  for (const note of track.notes) {
    if (isDrum) {
      renderDrumNote(ctx, note.midi, note.time, note.duration, note.velocity)
    } else {
      renderOscNote(ctx, note.midi, note.time, note.duration, note.velocity, patch)
    }
  }

  return ctx.startRendering()
}
