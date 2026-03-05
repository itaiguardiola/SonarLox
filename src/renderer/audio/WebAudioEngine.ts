import type { SourceId } from '../types'
import type { IAudioEngine, AnalyserSnapshot } from './IAudioEngine'
import { createPinkNoiseBuffer } from './TestTones'

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

  pause(): void {
    if (!this.currentSource) return
    if (!this.isOscillator && this.audioBuffer) {
      const elapsed = this.ctx.currentTime - this.playbackStartTime
      this.pauseOffset = elapsed % this.audioBuffer.duration
    }
    this.stopSource()
  }

  resume(isLooping: boolean): void {
    this.play(isLooping)
  }

  stop(): void {
    this.stopSource()
    this.pauseOffset = 0
  }

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

  setLooping(loop: boolean): void {
    if (
      this.currentSource &&
      !this.isOscillator &&
      this.currentSource instanceof AudioBufferSourceNode
    ) {
      this.currentSource.loop = loop
    }
  }

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

  isPaused(): boolean {
    return this.pauseOffset > 0 && this.currentSource === null
  }

  setPosition(x: number, y: number, z: number): void {
    this.pannerNode.positionX.value = x
    this.pannerNode.positionY.value = y
    this.pannerNode.positionZ.value = z
  }

  setVolume(volume: number): void {
    this.gainNode.gain.value = volume
  }

  setMuted(muted: boolean): void {
    this.gainNode.gain.value = muted ? 0 : 1
  }

  dispose(): void {
    this.stop()
    this.gainNode.disconnect()
    this.pannerNode.disconnect()
    this.analyserNode.disconnect()
  }
}

class WebAudioEngine implements IAudioEngine {
  private ctx: AudioContext | null = null
  private channels: Map<SourceId, SourceChannel> = new Map()
  private isLooping: boolean = true
  private masterGainNode: GainNode | null = null
  private masterAnalyserNode: AnalyserNode | null = null
  private transportStartTime: number = 0
  private _isPlaying: boolean = false
  private soloedIds: Set<SourceId> = new Set()

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

  createChannel(id: SourceId): void {
    if (!this.ctx || !this.masterGainNode || this.channels.has(id)) return
    this.channels.set(id, new SourceChannel(this.ctx, this.masterGainNode))
  }

  removeChannel(id: SourceId): void {
    const channel = this.channels.get(id)
    if (channel) {
      channel.dispose()
      this.channels.delete(id)
    }
    this.soloedIds.delete(id)
  }

  async loadFile(id: SourceId, arrayBuffer: ArrayBuffer): Promise<void> {
    await this.init()
    if (!this.channels.has(id)) this.createChannel(id)
    const channel = this.channels.get(id)!
    channel.stop()
    channel.audioBuffer = await this.ctx!.decodeAudioData(arrayBuffer)
  }

  async playTestTone(id: SourceId, type: 'sine' | 'pink-noise'): Promise<void> {
    await this.init()
    if (!this.channels.has(id)) this.createChannel(id)
    const channel = this.channels.get(id)!
    channel.playTestTone(type, this.isLooping)
    this._isPlaying = true
    this.transportStartTime = this.ctx!.currentTime
  }

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

  pauseAll(): void {
    for (const channel of this.channels.values()) {
      channel.pause()
    }
    this._isPlaying = false
  }

  stopAll(): void {
    for (const channel of this.channels.values()) {
      channel.stop()
    }
    this._isPlaying = false
    this.transportStartTime = 0
  }

  hasAnyPaused(): boolean {
    for (const channel of this.channels.values()) {
      if (channel.isPaused()) return true
    }
    return false
  }

  hasAnyBuffer(): boolean {
    for (const channel of this.channels.values()) {
      if (channel.audioBuffer) return true
    }
    return false
  }

  setPosition(id: SourceId, x: number, y: number, z: number): void {
    this.channels.get(id)?.setPosition(x, y, z)
  }

  setVolume(id: SourceId, vol: number): void {
    this.channels.get(id)?.setVolume(vol)
  }

  setMuted(id: SourceId, muted: boolean): void {
    const channel = this.channels.get(id)
    if (!channel) return
    if (muted) {
      channel.gainNode.gain.value = 0
    }
    // unmute is handled by AudioBridge setting the real volume
  }

  setSoloed(id: SourceId, soloed: boolean): void {
    if (soloed) {
      this.soloedIds.add(id)
    } else {
      this.soloedIds.delete(id)
    }
  }

  hasSoloedChannels(): boolean {
    return this.soloedIds.size > 0
  }

  isChannelSoloed(id: SourceId): boolean {
    return this.soloedIds.has(id)
  }

  setSineFrequency(id: SourceId, freq: number): void {
    this.channels.get(id)?.setSineFrequency(freq)
  }

  setLooping(loop: boolean): void {
    this.isLooping = loop
    for (const channel of this.channels.values()) {
      channel.setLooping(loop)
    }
  }

  getIsLooping(): boolean {
    return this.isLooping
  }

  setMasterVolume(volume: number): void {
    if (this.masterGainNode) {
      this.masterGainNode.gain.value = volume
    }
  }

  setListenerY(y: number): void {
    if (!this.ctx) return
    this.ctx.listener.positionY.value = y
  }

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

  getAnalyser(id: SourceId): AnalyserNode | null {
    return this.channels.get(id)?.analyserNode ?? null
  }

  setAudioBuffer(id: SourceId, buffer: AudioBuffer): void {
    if (!this.channels.has(id)) this.createChannel(id)
    const channel = this.channels.get(id)!
    channel.stop()
    channel.audioBuffer = buffer
  }

  getAudioBuffer(id: SourceId): AudioBuffer | null {
    return this.channels.get(id)?.audioBuffer ?? null
  }

  getChannelIds(): SourceId[] {
    return Array.from(this.channels.keys())
  }

  getDuration(): number {
    let max = 0
    for (const channel of this.channels.values()) {
      if (channel.audioBuffer) {
        max = Math.max(max, channel.audioBuffer.duration)
      }
    }
    return max
  }

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

  async enumerateDevices(): Promise<MediaDeviceInfo[]> {
    const devices = await navigator.mediaDevices.enumerateDevices()
    return devices.filter((d) => d.kind === 'audiooutput')
  }

  async setOutputDevice(deviceId: string): Promise<void> {
    if (!this.ctx) return
    // setSinkId is available on AudioContext in modern browsers
    if ('setSinkId' in this.ctx) {
      await (this.ctx as AudioContext & { setSinkId(id: string): Promise<void> }).setSinkId(deviceId)
    }
  }

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
