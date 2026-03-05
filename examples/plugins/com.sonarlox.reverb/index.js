/**
 * Simple Reverb plugin using ConvolverNode
 */
class SimpleReverb {
  activate(context) {
    this.ctx = context.audioContext;
    this.convolver = this.ctx.createConvolver();
    this.wetGain = this.ctx.createGain();
    this.dryGain = this.ctx.createGain();
    this.input = this.ctx.createGain();
    this.output = this.ctx.createGain();

    this.input.connect(this.dryGain);
    this.input.connect(this.convolver);
    this.convolver.connect(this.wetGain);
    this.dryGain.connect(this.output);
    this.wetGain.connect(this.output);

    this.wetGain.gain.value = 0.3;
    this.dryGain.gain.value = 0.7;

    this.generateImpulseResponse(2.0, 2.0);
  }

  generateImpulseResponse(duration, decay) {
    const sampleRate = this.ctx.sampleRate;
    const length = sampleRate * duration;
    const impulse = this.ctx.createBuffer(2, length, sampleRate);
    for (let i = 0; i < 2; i++) {
      const channelData = impulse.getChannelData(i);
      for (let j = 0; j < length; j++) {
        channelData[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / length, decay);
      }
    }
    this.convolver.buffer = impulse;
  }

  deactivate() {
    this.input.disconnect();
    this.convolver.disconnect();
    this.wetGain.disconnect();
    this.dryGain.disconnect();
    this.output.disconnect();
  }

  setParameter(id, value) {
    if (id === 'wet') {
      this.wetGain.gain.value = value;
    } else if (id === 'dry') {
      this.dryGain.gain.value = value;
    }
  }

  getParameters() {
    return {
      wet: this.wetGain.gain.value,
      dry: this.dryGain.gain.value
    };
  }

  getInputNode() { return this.input; }
  getOutputNode() { return this.output; }
}

module.exports = { default: SimpleReverb };
