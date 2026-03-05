import type { SourceId } from '../types'
import type { IAudioEngine, AnalyserSnapshot } from './IAudioEngine'
import { SourceChannel } from './SourceChannel'

/**
 * Implements the audio engine using Web Audio API for spatial audio playback.
 */
class WebAudioEngine implements IAudioEngine {
  private ctx: AudioContext | null = null
  private channels: Map<SourceId, SourceChannel> = new Map()
  private isLooping: boolean = true
  private masterGainNode: GainNode | null = null
  private masterAnalyserNode: AnalyserNode | null = null
  private transportStartTime: number = 0
  private _isPlaying: boolean = false
  private soloedIds: Set<SourceId> = new Set()

  /**
   * Initializes the audio context and creates necessary nodes.
   */
  async init(): Promise<void> {
    if (!this.ctx) {
      this.ctx = new AudioContext()
      this.masterGainNode = this.ctx.createGain()
      this.masterGainNode.gain.value = 1.0
      this.masterAnalyserNode = this.ctx.createAnalyser()
      this.masterAnalyserNode.fftSize = 2048
      // masterGain -> masterAnalyser -> destination
      this.masterGainNode.connect(this.masterAnalyserNode)
      this.masterAnalyserNode.connect(this.ctx.destination)
    }
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume()
    }
  }

  /**
   * Creates a new audio channel for the given source ID.
   */
  createChannel(id: SourceId): void {
    if (!this.ctx || !this.masterGainNode || this.channels.has(id)) return
    this.channels.set(id, new SourceChannel(this.ctx, this.masterGainNode))
  }

  /**
   * Removes an audio channel for the given source ID.
   */
  removeChannel(id: SourceId): void {
    const channel = this.channels.get(id)
    if (channel) {
      channel.dispose()
      this.channels.delete(id)
    }
    this.soloedIds.delete(id)
  }

  /**
   * Loads an audio file into the specified source channel.
   */
  async loadFile(id: SourceId, arrayBuffer: ArrayBuffer): Promise<void> {
    await this.init()
    if (!this.channels.has(id)) this.createChannel(id)
    const channel = this.channels.get(id)!
    channel.stop()
    channel.audioBuffer = await this.ctx!.decodeAudioData(arrayBuffer)
  }

  /**
   * Plays a test tone (sine or pink noise) for the specified source.
   */
  async playTestTone(id: SourceId, type: 'sine' | 'pink-noise'): Promise<void> {
    await this.init()
    if (!this.channels.has(id)) this.createChannel(id)
    const channel = this.channels.get(id)!
    channel.playTestTone(type, this.isLooping)
    this._isPlaying = true
    this.transportStartTime = this.ctx!.currentTime
  }

  /**
   * Starts playback for all audio channels.
   */
  playAll(): void {
    if (!this.ctx) return
    const startTime = this.ctx.currentTime + 0.01 // small lookahead for sample-accurate sync
    for (const channel of this.channels.values()) {
      if (!channel.audioBuffer) continue
      if (channel.isPaused()) {
        channel.play(this.isLooping, startTime)
      } else {
        channel.play(this.isLooping, startTime)
      }
    }
    this.transportStartTime = startTime
    this._isPlaying = true
  }

  /**
   * Pauses playback for all audio channels.
   */
  pauseAll(): void {
    for (const channel of this.channels.values()) {
      channel.pause()
    }
    this._isPlaying = false
  }

  /**
   * Stops playback for all audio channels.
   */
  stopAll(): void {
    for (const channel of this.channels.values()) {
      channel.stop()
    }
    this._isPlaying = false
    this.transportStartTime = 0
  }

  /**
   * Checks if any audio channel is currently paused.
   */
  hasAnyPaused(): boolean {
    for (const channel of this.channels.values()) {
      if (channel.isPaused()) return true
    }
    return false
  }

  /**
   * Checks if any audio channel has an audio buffer loaded.
   */
  hasAnyBuffer(): boolean {
    for (const channel of this.channels.values()) {
      if (channel.audioBuffer) return true
    }
    return false
  }

  /**
   * Sets the 3D position of an audio source.
   */
  setPosition(id: SourceId, x: number, y: number, z: number): void {
    this.channels.get(id)?.setPosition(x, y, z)
  }

  /**
   * Sets the volume of an audio source.
   */
  setVolume(id: SourceId, vol: number): void {
    this.channels.get(id)?.setVolume(vol)
  }

  /**
   * Sets the mute state of an audio source.
   */
  setMuted(id: SourceId, muted: boolean): void {
    const channel = this.channels.get(id)
    if (!channel) return
    if (muted) {
      channel.gainNode.gain.value = 0
    }
    // unmute is handled by AudioBridge setting the real volume
  }

  /**
   * Sets the solo state of an audio source.
   */
  setSoloed(id: SourceId, soloed: boolean): void {
    if (soloed) {
      this.soloedIds.add(id)
    } else {
      this.soloedIds.delete(id)
    }
  }

  /**
   * Checks if any audio source is currently soloed.
   */
  hasSoloedChannels(): boolean {
    return this.soloedIds.size > 0
  }

  /**
   * Checks if a specific audio source is soloed.
   */
  isChannelSoloed(id: SourceId): boolean {
    return this.soloedIds.has(id)
  }

  /**
   * Sets the frequency of a sine oscillator for a specific source.
   */
  setSineFrequency(id: SourceId, freq: number): void {
    this.channels.get(id)?.setSineFrequency(freq)
  }

  /**
   * Sets whether all audio sources loop.
   */
  setLooping(loop: boolean): void {
    this.isLooping = loop
    for (const channel of this.channels.values()) {
      channel.setLooping(loop)
    }
  }

  /**
   * Gets the current looping state.
   */
  getIsLooping(): boolean {
    return this.isLooping
  }

  /**
   * Sets the master volume for all audio sources.
   */
  setMasterVolume(volume: number): void {
    if (this.masterGainNode) {
      this.masterGainNode.gain.value = volume
    }
  }

  /**
   * Sets the vertical position of the audio listener.
   */
  setListenerY(y: number): void {
    if (!this.ctx) return
    this.ctx.listener.positionY.value = y
  }

  /**
   * Gets a snapshot of the analyser data for a specific source.
   */
  getAnalyserSnapshot(id: SourceId): AnalyserSnapshot | null {
    const channel = this.channels.get(id)
    if (!channel) return null
    const analyser = channel.analyserNode
    const frequency = new Float32Array(analyser.frequencyBinCount)
    const waveform = new Float32Array(analyser.fftSize)
    analyser.getFloatFrequencyData(frequency)
    analyser.getFloatTimeDomainData(waveform)
    return { frequency, waveform }
  }

  /**
   * Gets the analyser node for a specific source.
   */
  getAnalyser(id: SourceId): AnalyserNode | null {
    return this.channels.get(id)?.analyserNode ?? null
  }

  /**
   * Sets an audio buffer directly for a source.
   */
  setAudioBuffer(id: SourceId, buffer: AudioBuffer): void {
    if (!this.channels.has(id)) this.createChannel(id)
    const channel = this.channels.get(id)!
    channel.stop()
    channel.audioBuffer = buffer
  }

  /**
   * Gets the audio buffer for a specific source.
   */
  getAudioBuffer(id: SourceId): AudioBuffer | null {
    return this.channels.get(id)?.audioBuffer ?? null
  }

  /**
   * Gets the list of all source IDs.
   */
  getChannelIds(): SourceId[] {
    return Array.from(this.channels.keys())
  }

  /**
   * Gets the maximum duration of all audio buffers.
   */
  getDuration(): number {
    let max = 0
    for (const channel of this.channels.values()) {
      if (channel.audioBuffer) {
        max = Math.max(max, channel.audioBuffer.duration)
      }
    }
    return max
  }

  /**
   * Sets the playhead position for all audio channels.
   */
  setPlayheadPosition(pos: number): void {
    if (!this.ctx) return
    const duration = this.getDuration()
    const offset = duration > 0 ? pos % duration : 0
    
    // Use a small lookahead for sync if playing
    const startTime = this._isPlaying ? this.ctx.currentTime + 0.01 : 0
    
    for (const channel of this.channels.values()) {
      channel.setPlayheadPosition(offset, this._isPlaying, this.isLooping, startTime)
    }
    
    if (this._isPlaying) {
      this.transportStartTime = startTime - offset
    } else {
      this.transportStartTime = this.ctx.currentTime - offset
    }
  }

  /**
   * Gets the current playhead position.
   */
  getPlayheadPosition(): number {
    if (!this.ctx || !this._isPlaying) return 0
    const elapsed = this.ctx.currentTime - this.transportStartTime
    const duration = this.getDuration()
    if (duration === 0) return 0
    if (this.isLooping) {
      return elapsed % duration
    }
    return Math.min(elapsed, duration)
  }

  /**
   * Gets all buffered audio sources with their metadata.
   */
  getAllBufferedSources(): {
    id: SourceId
    audioBuffer: AudioBuffer
    position: [number, number, number]
    volume: number
  }[] {
    const result: {
      id: SourceId
      audioBuffer: AudioBuffer
      position: [number, number, number]
      volume: number
    }[] = []
    for (const [id, channel] of this.channels) {
      if (channel.audioBuffer) {
        result.push({
          id,
          audioBuffer: channel.audioBuffer,
          position: [
            channel.pannerNode.positionX.value,
            channel.pannerNode.positionY.value,
            channel.pannerNode.positionZ.value,
          ],
          volume: channel.gainNode.gain.value,
        })
      }
    }
    return result
  }

  /**
   * Enumerates available audio output devices.
   */
  async enumerateDevices(): Promise<MediaDeviceInfo[]> {
    const devices = await navigator.mediaDevices.enumerateDevices()
    return devices.filter((d) => d.kind === 'audiooutput')
  }

  /**
   * Sets the audio output device.
   */
  async setOutputDevice(deviceId: string): Promise<void> {
    if (!this.ctx) return
    // setSinkId is available on AudioContext in modern browsers
    if ('setSinkId' in this.ctx) {
      await (this.ctx as AudioContext & { setSinkId(id: string): Promise<void> }).setSinkId(deviceId)
    }
  }

  /**
   * Returns the underlying AudioContext.
   */
  getAudioContext(): AudioContext | null {
    return this.ctx
  }

  /**
   * Returns the gain and panner nodes for a source channel.
   */
  getChannelNodes(id: SourceId): { gainNode: GainNode; pannerNode: PannerNode } | null {
    const channel = this.channels.get(id)
    if (!channel) return null
    return { gainNode: channel.gainNode, pannerNode: channel.pannerNode }
  }

  /**
   * Returns the master gain and analyser nodes.
   */
  getMasterNodes(): { masterGainNode: GainNode; masterAnalyserNode: AnalyserNode } | null {
    if (!this.masterGainNode || !this.masterAnalyserNode) return null
    return { masterGainNode: this.masterGainNode, masterAnalyserNode: this.masterAnalyserNode }
  }

  /**
   * Disposes of all audio resources.
   */
  dispose(): void {
    for (const channel of this.channels.values()) {
      channel.dispose()
    }
    this.channels.clear()
    this.soloedIds.clear()
    if (this.masterGainNode) {
      this.masterGainNode.disconnect()
      this.masterGainNode = null
    }
    if (this.masterAnalyserNode) {
      this.masterAnalyserNode.disconnect()
      this.masterAnalyserNode = null
    }
    if (this.ctx) {
      this.ctx.close()
      this.ctx = null
    }
  }
}

export const audioEngine = new WebAudioEngine()
