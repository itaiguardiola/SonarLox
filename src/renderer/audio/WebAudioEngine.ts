import type { SourceId } from '../types'
import type { IAudioEngine, AnalyserSnapshot } from './IAudioEngine'
import { createPinkNoiseBuffer } from './TestTones'

/**
 * Manages a single audio source channel with spatialization and playback controls.
 */
class SourceChannel {
  gainNode: GainNode
  pannerNode: PannerNode
  analyserNode: AnalyserNode
  currentSource: AudioBufferSourceNode | OscillatorNode | null = null
  audioBuffer: AudioBuffer | null = null
  playbackStartTime: number = 0
  pauseOffset: number = 0
  isOscillator: boolean = false
  sineFrequency: number = 440

  constructor(private ctx: AudioContext, masterGain: GainNode) {
    this.gainNode = ctx.createGain()
    this.gainNode.gain.value = 1.0

    this.pannerNode = ctx.createPanner()
    this.pannerNode.panningModel = 'HRTF'
    this.pannerNode.distanceModel = 'inverse'
    this.pannerNode.refDistance = 1
    this.pannerNode.maxDistance = 50
    this.pannerNode.rolloffFactor = 1

    this.analyserNode = ctx.createAnalyser()
    this.analyserNode.fftSize = 2048

    // Chain: gain -> panner -> analyser -> masterGain
    this.gainNode.connect(this.pannerNode)
    this.pannerNode.connect(this.analyserNode)
    this.analyserNode.connect(masterGain)
  }

  /**
   * Starts playback of the audio buffer.
   */
  play(isLooping: boolean, startTime?: number): void {
    if (!this.audioBuffer) return
    this.stopSource()

    const source = this.ctx.createBufferSource()
    source.buffer = this.audioBuffer
    source.loop = isLooping
    source.connect(this.gainNode)

    const offset = this.pauseOffset % this.audioBuffer.duration
    if (startTime !== undefined) {
      source.start(startTime, offset)
      this.playbackStartTime = startTime - offset
    } else {
      source.start(0, offset)
      this.playbackStartTime = this.ctx.currentTime - offset
    }
    this.currentSource = source
    this.isOscillator = false

    if (!isLooping) {
      source.onended = () => {
        this.currentSource = null
        this.pauseOffset = 0
      }
    }
  }

  /**
   * Plays a test tone (sine or pink noise) for the source.
   */
  playTestTone(type: 'sine' | 'pink-noise', isLooping: boolean): void {
    this.stop()

    if (type === 'sine') {
      const freq = this.sineFrequency
      const duration = 4
      const sampleRate = this.ctx.sampleRate
      const length = sampleRate * duration
      const sineBuffer = this.ctx.createBuffer(1, length, sampleRate)
      const data = sineBuffer.getChannelData(0)
      for (let i = 0; i < length; i++) {
        data[i] = Math.sin((2 * Math.PI * freq * i) / sampleRate)
      }
      this.audioBuffer = sineBuffer

      const osc = this.ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = freq
      osc.connect(this.gainNode)
      osc.start()
      this.currentSource = osc
      this.isOscillator = true
    } else {
      const buffer = createPinkNoiseBuffer(this.ctx)
      this.audioBuffer = buffer
      const source = this.ctx.createBufferSource()
      source.buffer = buffer
      source.loop = isLooping
      source.connect(this.gainNode)
      source.start()
      this.playbackStartTime = this.ctx.currentTime
      this.currentSource = source
      this.isOscillator = false
    }
  }

  /**
   * Pauses playback of the audio source.
   */
  pause(): void {
    if (!this.currentSource) return
    if (!this.isOscillator && this.audioBuffer) {
      const elapsed = this.ctx.currentTime - this.playbackStartTime
      this.pauseOffset = elapsed % this.audioBuffer.duration
    }
    this.stopSource()
  }

  /**
   * Resumes playback of the audio source.
   */
  resume(isLooping: boolean): void {
    this.play(isLooping)
  }

  /**
   * Stops playback of the audio source.
   */
  stop(): void {
    this.stopSource()
    this.pauseOffset = 0
  }

  /**
   * Internal method to stop and disconnect the current audio source.
   */
  private stopSource(): void {
    if (this.currentSource) {
      try {
        this.currentSource.stop()
      } catch {
        // Already stopped
      }
      this.currentSource.disconnect()
      this.currentSource = null
    }
  }

  /**
   * Sets whether the audio source loops.
   */
  setLooping(loop: boolean): void {
    if (
      this.currentSource &&
      !this.isOscillator &&
      this.currentSource instanceof AudioBufferSourceNode
    ) {
      this.currentSource.loop = loop
    }
  }

  /**
   * Sets the frequency of the sine oscillator.
   */
  setSineFrequency(freq: number): void {
    this.sineFrequency = freq
    if (this.isOscillator && this.currentSource instanceof OscillatorNode) {
      this.currentSource.frequency.value = freq
    }
    if (this.isOscillator) {
      const duration = 4
      const sampleRate = this.ctx.sampleRate
      const length = sampleRate * duration
      const sineBuffer = this.ctx.createBuffer(1, length, sampleRate)
      const data = sineBuffer.getChannelData(0)
      for (let i = 0; i < length; i++) {
        data[i] = Math.sin((2 * Math.PI * freq * i) / sampleRate)
      }
      this.audioBuffer = sineBuffer
    }
  }

  /**
   * Checks if the audio source is currently paused.
   */
  isPaused(): boolean {
    return this.pauseOffset > 0 && this.currentSource === null
  }

  /**
   * Sets the 3D position of the audio source.
   */
  setPosition(x: number, y: number, z: number): void {
    this.pannerNode.positionX.value = x
    this.pannerNode.positionY.value = y
    this.pannerNode.positionZ.value = z
  }

  /**
   * Sets the volume of the audio source.
   */
  setVolume(volume: number): void {
    this.gainNode.gain.value = volume
  }

  /**
   * Sets the mute state of the audio source.
   */
  setMuted(muted: boolean): void {
    this.gainNode.gain.value = muted ? 0 : 1
  }

  /**
   * Disposes of the audio resources for this channel.
   */
  dispose(): void {
    this.stop()
    this.gainNode.disconnect()
    this.pannerNode.disconnect()
    this.analyserNode.disconnect()
  }
}

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
