import { SoundLayer } from '../utils/synth';

// the drums every track shares: kick, snare and hi-hat
export const kit: Record<string, SoundLayer[]> = {
  k: [{ wave: 'sine', duration: 0.16, from: 160, to: 45, volume: 0.4, decay: 1.5 }],
  s: [
    { wave: 'noise', duration: 0.14, from: 6000, to: 2500, volume: 0.16, decay: 2 },
    { wave: 'triangle', duration: 0.08, from: 220, to: 160, volume: 0.12 },
  ],
  h: [{ wave: 'noise', duration: 0.035, from: 10000, to: 8000, volume: 0.05, decay: 3 }],
};
