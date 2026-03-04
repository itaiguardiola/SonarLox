import { createPinkNoiseBuffer } from './TestTones'

class AudioEngine {
  private ctx: AudioContext | null = null
  private gainNode: GainNode | null = null
  private pannerNode: PannerNode | null = null
  private analyserNode: AnalyserNode | null = null
  private currentSource: AudioBufferSourceNode | OscillatorNode | null = null
  private audioBuffer: AudioBuffer | null = null

  async init(): Promise<void> {
    if (!this.ctx) {
      this.ctx = new AudioContext()

      this.gainNode = this.ctx.createGain()
      this.gainNode.gain.value = 1.0

      this.pannerNode = this.ctx.createPanner()
      this.pannerNode.panningModel = 'HRTF'
      this.pannerNode.distanceModel = 'inverse'
      this.pannerNode.refDistance = 1
      this.pannerNode.maxDistance = 50
      this.pannerNode.rolloffFactor = 1

      this.analyserNode = this.ctx.createAnalyser()
      this.analyserNode.fftSize = 2048

      // Wire: gain -> panner -> analyser -> destination
      this.gainNode.connect(this.pannerNode)
      this.pannerNode.connect(this.analyserNode)
      this.analyserNode.connect(this.ctx.destination)
    }

    if (this.ctx.state === 'suspended') {
      await this.ctx.resume()
    }
  }

  async loadFile(arrayBuffer: ArrayBuffer): Promise<void> {
    await this.init()
    this.stop()
    this.audioBuffer = await this.ctx!.decodeAudioData(arrayBuffer)
  }

  play(): void {
    if (!this.ctx || !this.gainNode || !this.audioBuffer) return
    this.stop()

    const source = this.ctx.createBufferSource()
    source.buffer = this.audioBuffer
    source.loop = true
    source.connect(this.gainNode)
    source.start()
    this.currentSource = source
  }

  async playTestTone(type: 'sine' | 'pink-noise'): Promise<void> {
    await this.init()
    this.stop()

    if (type === 'sine') {
      // Generate a 4-second sine buffer for export support
      const duration = 4
      const sampleRate = this.ctx!.sampleRate
      const length = sampleRate * duration
      const sineBuffer = this.ctx!.createBuffer(1, length, sampleRate)
      const data = sineBuffer.getChannelData(0)
      for (let i = 0; i < length; i++) {
        data[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate)
      }
      this.audioBuffer = sineBuffer

      const osc = this.ctx!.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = 440
      osc.connect(this.gainNode!)
      osc.start()
      this.currentSource = osc
    } else {
      const buffer = createPinkNoiseBuffer(this.ctx!)
      this.audioBuffer = buffer
      const source = this.ctx!.createBufferSource()
      source.buffer = buffer
      source.loop = true
      source.connect(this.gainNode!)
      source.start()
      this.currentSource = source
    }
  }

  stop(): void {
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

  setPosition(x: number, y: number, z: number): void {
    if (!this.pannerNode) return
    this.pannerNode.positionX.value = x
    this.pannerNode.positionY.value = y
    this.pannerNode.positionZ.value = z
  }

  setVolume(volume: number): void {
    if (!this.gainNode) return
    this.gainNode.gain.value = volume
  }

  getAudioBuffer(): AudioBuffer | null {
    return this.audioBuffer
  }

  getVolume(): number {
    return this.gainNode?.gain.value ?? 1
  }

  getAnalyser(): AnalyserNode | null {
    return this.analyserNode
  }

  dispose(): void {
    this.stop()
    if (this.ctx) {
      this.ctx.close()
      this.ctx = null
    }
    this.gainNode = null
    this.pannerNode = null
    this.analyserNode = null
    this.audioBuffer = null
  }
}

export const audioEngine = new AudioEngine()
