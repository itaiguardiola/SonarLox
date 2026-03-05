/**
 * Spectrum Visualizer plugin using R3F
 */
class SpectrumVisualizer {
  activate(context) {
    this.ctx = context.audioContext;
    this.scale = 1.0;
  }

  deactivate() {}

  setParameter(id, value) {
    if (id === 'scale') {
      this.scale = value;
    }
  }

  getParameters() {
    return { scale: this.scale };
  }

  render({ sources, audioEngine }) {
    return React.createElement('group', null,
      sources.map((source, i) => {
        return React.createElement(SpectrumBars, {
          key: source.id,
          sourceId: source.id,
          position: source.position,
          color: source.color,
          scale: this.scale,
          audioEngine
        });
      })
    );
  }
}

function SpectrumBars({ sourceId, position, color, scale, audioEngine }) {
  const meshRef = React.useRef();
  const [data] = React.useState(() => new Float32Array(32));

  // Note: we can't use @react-three/fiber's useFrame here easily 
  // if we don't have access to the library in the sandbox.
  // But we are in the same process, so we might be able to use it if it's passed or globally available.
  // For now, let's assume we can use standard React hooks.
  
  React.useEffect(() => {
    let frame;
    const update = () => {
      const snapshot = audioEngine.getAnalyserSnapshot(sourceId);
      if (snapshot && snapshot.frequency) {
        // Average frequency bins to fit 32 bars
        const binsPerBar = Math.floor(snapshot.frequency.length / 32);
        for (let i = 0; i < 32; i++) {
          let sum = 0;
          for (let j = 0; j < binsPerBar; j++) {
            sum += snapshot.frequency[i * binsPerBar + j];
          }
          // snapshot.frequency is in dB (-100 to 0)
          const val = Math.max(0, (sum / binsPerBar + 100) / 100);
          data[i] = val * scale;
        }
      }
      frame = requestAnimationFrame(update);
    };
    update();
    return () => cancelAnimationFrame(frame);
  }, [sourceId, scale, audioEngine]);

  return React.createElement('group', { position: [position[0], position[1] + 1, position[2]] },
    Array.from({ length: 32 }).map((_, i) => {
      const h = data[i] || 0.1;
      return React.createElement('mesh', {
        key: i,
        position: [(i - 16) * 0.1, h / 2, 0],
      },
        React.createElement('boxGeometry', { args: [0.08, h, 0.08] }),
        React.createElement('meshBasicMaterial', { 
          color: color,
          transparent: true,
          opacity: 0.6
        })
      );
    })
  );
}

module.exports = { default: SpectrumVisualizer };
