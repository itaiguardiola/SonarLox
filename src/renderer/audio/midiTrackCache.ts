import type { SourceId } from '../types'
import type { MidiTrackData } from './MidiParser'

const cache = new Map<SourceId, MidiTrackData>()
const bufferCache = new Map<SourceId, ArrayBuffer>()

export function setTrack(id: SourceId, track: MidiTrackData): void {
  cache.set(id, track)
}

export function getTrack(id: SourceId): MidiTrackData | undefined {
  return cache.get(id)
}

export function setMidiBuffer(id: SourceId, buffer: ArrayBuffer): void {
  bufferCache.set(id, buffer)
}

export function getMidiBuffer(id: SourceId): ArrayBuffer | undefined {
  return bufferCache.get(id)
}

export function deleteTrack(id: SourceId): void {
  cache.delete(id)
  bufferCache.delete(id)
}

export function getAllMidiSourceIds(): SourceId[] {
  return Array.from(cache.keys())
}
