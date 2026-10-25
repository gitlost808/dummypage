import { SoundLayer } from './synth';
import { Song } from './tracker';

// the background music: a 16-bar chiptune loop in A minor, rendered at boot (see tracker.ts)

const kit: Record<string, SoundLayer[]> = {
  k: [{ wave: 'sine', duration: 0.16, from: 160, to: 45, volume: 0.4, decay: 1.5 }],
  s: [
    { wave: 'noise', duration: 0.14, from: 6000, to: 2500, volume: 0.16, decay: 2 },
    { wave: 'triangle', duration: 0.08, from: 220, to: 160, volume: 0.12 },
  ],
  h: [{ wave: 'noise', duration: 0.035, from: 10000, to: 8000, volume: 0.05, decay: 3 }],
};

// a bar of each chord: bass bouncing between root and octave, and an arpeggio below the lead
const chords: Record<string, { bass: [string, string]; arp: string[] }> = {
  Am: { bass: ['A2', 'A3'], arp: ['A3', 'C4', 'E4', 'A4'] },
  F: { bass: ['F2', 'F3'], arp: ['F3', 'A3', 'C4', 'F4'] },
  C: { bass: ['C3', 'C4'], arp: ['G3', 'C4', 'E4', 'G4'] },
  G: { bass: ['G2', 'G3'], arp: ['G3', 'B3', 'D4', 'G4'] },
  E: { bass: ['E2', 'E3'], arp: ['G#3', 'B3', 'E4', 'G#4'] },
};
const arpOrder = [0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 2, 1, 0, 1, 2, 1];

const bassBar = (chord: string) => {
  const [root, octave] = chords[chord].bass;
  return `${root} - ${octave} - `.repeat(4);
};
const arpBar = (chord: string) => arpOrder.map((i) => chords[chord].arp[i]).join(' ');

const verse = ['Am', 'F', 'C', 'G'];
// ends on E major, which pulls back to A minor as the loop restarts
const chorus = ['Am', 'F', 'G', 'E'];
const progression = [...verse, ...verse, ...chorus, ...chorus];

const drums = {
  light: 'k . h . . . h . k . h . . . h .',
  full: 'k . h . s . h . k . k h s . h .',
  // into the chorus, and into the loop restarting
  fill: 'k . h . s . h . s . s . s s s s',
};

// one bar per line; the intro has no melody
const lead = `
  . . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . |
  . . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . |

  A4 - C5 - E5 - - - D5 - C5 - D5 - E5 - |
  F5 - - - E5 - C5 - A4 - - - C5 - - -   |
  G5 - - - E5 - G5 - C6 - - - B5 - G5 -  |
  D5 - - - - - - - B4 - D5 - G5 - - -    |

  A5 - - - G5 - E5 - C5 - - - E5 - A5 -  |
  C6 - - - A5 - - - F5 - A5 - C6 - A5 -  |
  B5 - - - G5 - D5 - B4 - D5 - G5 - B5 - |
  G#5 - - - - - - - E5 - - - B4 - - -    |

  E5 - A5 - C6 - B5 - A5 - - - E5 - - -  |
  F5 - A5 - C6 - - - D6 - C6 - A5 - - -  |
  B5 - - - D6 - - - G5 - - - B5 - D6 -   |
  E6 - - - - - - - - - - - . . . .       |
`;

export const music: Song = {
  bpm: 132,
  stepsPerBeat: 4,
  tracks: [
    { instrument: { wave: 'square', volume: 0.08, decay: 0.8 }, notes: progression.map(bassBar).join(' | ') },
    { instrument: { wave: 'triangle', volume: 0.12, decay: 1.5 }, notes: progression.map(arpBar).join(' | ') },
    { instrument: { wave: 'square', volume: 0.07, attack: 0.01, decay: 0.6 }, notes: lead },
  ],
  drums: [
    {
      kit,
      hits: [
        ...Array(4).fill(drums.light),
        ...Array(3).fill(drums.full),
        drums.fill,
        ...Array(7).fill(drums.full),
        drums.fill,
      ].join(' | '),
    },
  ],
};
