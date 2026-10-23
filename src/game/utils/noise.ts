// tileable Perlin noise, used to generate the background nebula

type Rng = () => number;

export type NebulaOptions = {
  size: number;
  // lattice cells across the texture for the first (largest) octave; a whole number
  basePeriod: number;
  octaves: number;
  // density below this (0..1) is fully transparent
  coverage: number;
  maxAlpha: number;
  // cloud colours, blended by a second, slower noise field
  colors: [number, number];
  rng?: Rng;
};

const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// Perlin noise whose gradient lattice wraps every `period` cells, so it tiles seamlessly
function periodicPerlin(period: number, rng: Rng): (x: number, y: number) => number {
  const gradients = Array.from({ length: period * period }, () => {
    const angle = rng() * Math.PI * 2;
    return [Math.cos(angle), Math.sin(angle)];
  });
  const dot = (ix: number, iy: number, dx: number, dy: number) => {
    const [gx, gy] = gradients[(iy % period) * period + (ix % period)];
    return gx * dx + gy * dy;
  };

  return (x, y) => {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const u = fade(fx);
    const top = lerp(dot(x0, y0, fx, fy), dot(x0 + 1, y0, fx - 1, fy), u);
    const bottom = lerp(dot(x0, y0 + 1, fx, fy - 1), dot(x0 + 1, y0 + 1, fx - 1, fy - 1), u);
    return lerp(top, bottom, fade(fy));
  };
}

// fractal noise (octaves of periodic Perlin), normalised to 0..1 over the texture
export function tileableFbm(size: number, basePeriod: number, octaves: number, rng: Rng = Math.random): Float32Array {
  const layers = Array.from({ length: octaves }, (_, i) => ({
    noise: periodicPerlin(basePeriod * 2 ** i, rng),
    period: basePeriod * 2 ** i,
    amplitude: 0.5 ** i,
  }));

  const values = new Float32Array(size * size);
  let min = Infinity;
  let max = -Infinity;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let value = 0;
      for (const { noise, period, amplitude } of layers) {
        value += noise((x / size) * period, (y / size) * period) * amplitude;
      }
      values[y * size + x] = value;
      min = Math.min(min, value);
      max = Math.max(max, value);
    }
  }

  const range = max - min || 1;
  for (let i = 0; i < values.length; i++) values[i] = (values[i] - min) / range;
  return values;
}

// RGBA pixels for a seamless nebula texture
export function nebulaPixels(options: NebulaOptions): Uint8ClampedArray {
  const { size, basePeriod, octaves, coverage, maxAlpha, colors, rng = Math.random } = options;
  const density = tileableFbm(size, basePeriod, octaves, rng);
  // periods must be whole numbers for the lattice to wrap
  const tint = tileableFbm(size, Math.max(1, Math.floor(basePeriod / 2)), 2, rng);
  const [from, to] = colors;

  const pixels = new Uint8ClampedArray(size * size * 4);
  for (let i = 0; i < density.length; i++) {
    // smoothstep from the coverage threshold up to full density
    const t = Math.min(Math.max((density[i] - coverage) / (1 - coverage), 0), 1);
    const alpha = t * t * (3 - 2 * t) * maxAlpha;
    const mix = tint[i];
    pixels[i * 4] = lerp((from >> 16) & 0xff, (to >> 16) & 0xff, mix);
    pixels[i * 4 + 1] = lerp((from >> 8) & 0xff, (to >> 8) & 0xff, mix);
    pixels[i * 4 + 2] = lerp(from & 0xff, to & 0xff, mix);
    pixels[i * 4 + 3] = alpha * 255;
  }
  return pixels;
}
