import { Midi } from '@tonejs/midi'

export interface MidiNote {
  midi: number
  time: number
  duration: number
  velocity: number
}

export interface MidiTrackData {
  name: string
  channel: number
  program: number
  notes: MidiNote[]
  duration: number
}

export function parseMidi(arrayBuffer: ArrayBuffer): MidiTrackData[] {
  const midi = new Midi(arrayBuffer)

  // Collect tracks, combining by channel
  const channelMap = new Map<number, MidiTrackData>()

  for (const track of midi.tracks) {
    if (track.notes.length === 0) continue

    const channel = track.channel
    const existing = channelMap.get(channel)

    const notes: MidiNote[] = track.notes.map((n) => ({
      midi: n.midi,
      time: n.time,
      duration: n.duration,
      velocity: n.velocity,
    }))

    if (existing) {
      // Merge into existing channel track
      existing.notes.push(...notes)
      existing.duration = Math.max(
        existing.duration,
        ...notes.map((n) => n.time + n.duration)
      )
      // Keep the first non-empty name
      if (!existing.name && track.name) {
        existing.name = track.name
      }
      // Keep the first non-zero program
      if (existing.program === 0 && track.instrument.number !== 0) {
        existing.program = track.instrument.number
      }
    } else {
      const maxEnd = notes.reduce((max, n) => Math.max(max, n.time + n.duration), 0)
      channelMap.set(channel, {
        name: track.name || '',
        channel,
        program: track.instrument.number,
        notes,
        duration: maxEnd,
      })
    }
  }

  // Sort merged notes by time within each track
  for (const track of channelMap.values()) {
    track.notes.sort((a, b) => a.time - b.time)
  }

  // Convert to array, assign default names
  let tracks = Array.from(channelMap.values())

  // Sort by number of notes descending so we keep the most active tracks
  tracks.sort((a, b) => b.notes.length - a.notes.length)

  // Cap at 8 tracks
  if (tracks.length > 8) {
    tracks = tracks.slice(0, 8)
  }

  // Assign default names where missing
  tracks.forEach((t, i) => {
    if (!t.name) {
      t.name = `Track ${i + 1}`
    }
  })

  return tracks
}
