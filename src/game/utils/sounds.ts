import { SoundLayer } from './synth';

export type SoundKey =
  | 'shoot'
  | 'enemy-shoot'
  | 'enemy-hit'
  | 'dive-warn'
  | 'explosion'
  | 'big-explosion'
  | 'shield-hit'
  | 'powerup'
  | 'game-over';

// every sound effect in the game, synthesized at boot
export const sounds: Record<SoundKey, SoundLayer[]> = {
  // fired several times a second, so short and quiet
  shoot: [{ wave: 'square', duration: 0.08, from: 1200, to: 300, volume: 0.1 }],
  'enemy-shoot': [{ wave: 'triangle', duration: 0.12, from: 520, to: 180, volume: 0.18 }],
  // a tank taking a hit without dying
  'enemy-hit': [{ wave: 'square', duration: 0.05, from: 1800, to: 1100, volume: 0.1, decay: 3 }],
  // a diver winding up, rising so it reads as a warning
  'dive-warn': [{ wave: 'saw', duration: 0.3, from: 300, to: 900, volume: 0.1, decay: 1 }],
  explosion: [
    { wave: 'noise', duration: 0.35, from: 4000, to: 300, volume: 0.35, decay: 1.5 },
    { wave: 'sine', duration: 0.2, from: 180, to: 50, volume: 0.35 },
  ],
  // bombs and the player's death
  'big-explosion': [
    { wave: 'noise', duration: 1.0, from: 2500, to: 80, volume: 0.5, decay: 1.2 },
    { wave: 'sine', duration: 0.6, from: 120, to: 30, volume: 0.5, decay: 1.5 },
  ],
  'shield-hit': [
    { wave: 'sine', duration: 0.3, from: 900, to: 200, volume: 0.3 },
    { wave: 'noise', duration: 0.15, from: 6000, to: 1500, volume: 0.12 },
  ],
  // rising major arpeggio
  powerup: [
    { wave: 'square', duration: 0.32, from: 523, to: 523, volume: 0.1, decay: 0.5, steps: [1, 1.26, 1.5, 2] },
  ],
  // falling arpeggio, delayed so it plays after the death explosion
  // (the scene clock is paused on game over, so the delay is baked into the sound)
  'game-over': [
    { wave: 'triangle', duration: 1.2, from: 392, to: 392, volume: 0.3, decay: 1, steps: [1, 0.84, 0.75, 0.5], delay: 0.5 },
  ],
};
