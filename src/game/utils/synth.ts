// tiny retro synthesizer: renders sound effects from code into raw samples

type Rng = () => number;

export type Wave = 'square' | 'triangle' | 'sine' | 'saw' | 'noise';

export type SoundLayer = {
  wave: Wave;
  // seconds
  duration: number;
  // pitch in Hz, swept exponentially from `from` to `to`; for noise it's the lowpass cutoff
  from: number;
  to: number;
  volume: number;
  // seconds of fade-in, which also avoids a click at the start
  attack?: number;
  // how steeply the volume falls off over the duration; higher fades sooner
  decay?: number;
  // pitch multipliers stepped through evenly over the duration (an arpeggio)
  steps?: number[];
  // seconds before this layer starts
  delay?: number;
};

// mixes the layers into one mono buffer of samples in -1..1
export function synthesize(layers: SoundLayer[], sampleRate: number, rng: Rng = Math.random): Float32Array<ArrayBuffer> {
  const seconds = Math.max(...layers.map((layer) => (layer.delay ?? 0) + layer.duration));
  const out = new Float32Array(Math.ceil(seconds * sampleRate));
  for (const layer of layers) renderLayer(layer, out, sampleRate, rng);
  for (let i = 0; i < out.length; i++) out[i] = Math.min(Math.max(out[i], -1), 1);
  return out;
}

function renderLayer(layer: SoundLayer, out: Float32Array, sampleRate: number, rng: Rng): void {
  const { wave, duration, from, to, volume, attack = 0.005, decay = 2, steps = [1], delay = 0 } = layer;
  const start = Math.floor(delay * sampleRate);
  const length = Math.floor(duration * sampleRate);
  let phase = 0;
  let filtered = 0;

  for (let i = 0; i < length && start + i < out.length; i++) {
    const t = i / length;
    const step = steps[Math.min(steps.length - 1, Math.floor(t * steps.length))];
    const frequency = from * (to / from) ** t * step;
    const envelope = Math.min(1, i / sampleRate / attack) * (1 - t) ** decay;

    let sample: number;
    if (wave === 'noise') {
      // white noise through a one-pole lowpass, rescaled so lowering the cutoff doesn't also lower the volume
      const alpha = 1 - Math.exp((-2 * Math.PI * frequency) / sampleRate);
      filtered += (rng() * 2 - 1 - filtered) * alpha;
      sample = filtered * Math.sqrt((2 - alpha) / alpha) * 0.5;
    } else {
      phase = (phase + frequency / sampleRate) % 1;
      sample = oscillator(wave, phase);
    }
    out[start + i] += sample * envelope * volume;
  }
}

function oscillator(wave: Exclude<Wave, 'noise'>, phase: number): number {
  switch (wave) {
    case 'square':
      return phase < 0.5 ? 1 : -1;
    case 'triangle':
      return 1 - 4 * Math.abs(phase - 0.5);
    case 'saw':
      return 2 * phase - 1;
    case 'sine':
      return Math.sin(phase * 2 * Math.PI);
  }
}
