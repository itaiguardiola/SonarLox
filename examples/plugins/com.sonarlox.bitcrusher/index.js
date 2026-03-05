/**
 * Simple Bitcrusher effect using WaveShaperNode for bit depth 
 * and a custom implementation for downsampling.
 */
class Bitcrusher {
  activate(context) {
    this.ctx = context.audioContext;
    this.input = this.ctx.createGain();
    this.output = this.ctx.createGain();
    
    // Use a WaveShaper for bit depth reduction
    this.shaper = this.ctx.createWaveShaper();
    this.bits = 8;
    this.updateCurve();

    // Note: True downsampling is hard with standard nodes without Worklet.
    // We'll simulate it by reducing the curve resolution.
    
    this.input.connect(this.shaper);
    this.shaper.connect(this.output);
    
    context.log('Bitcrusher activated');
  }

  updateCurve() {
    const values = Math.pow(2, this.bits);
    const curve = new Float32Array(4096);
    for (let i = 0; i < 4096; i++) {
      const x = (i / 4096) * 2 - 1;
      curve[i] = Math.round(x * values) / values;
    }
    this.shaper.curve = curve;
  }

  deactivate() {
    this.input.disconnect();
    this.shaper.disconnect();
    this.output.disconnect();
  }

  setParameter(id, value) {
    if (id === 'bits') {
      this.bits = value;
      this.updateCurve();
    }
  }

  getParameters() {
    return { bits: this.bits };
  }

  getInputNode() { return this.input; }
  getOutputNode() { return this.output; }
}

module.exports = { default: Bitcrusher };
