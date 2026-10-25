import { Song } from '../utils/tracker';
import { kit } from './kit';

// the boss theme: faster and darker, a 16-bar loop in E minor with a chugging bass and a buzzing lead

const chords: Record<string, { bass: [string, string]; arp: string[] }> = {
  Em: { bass: ['E2', 'E3'], arp: ['E3', 'G3', 'B3', 'E4'] },
  C: { bass: ['C2', 'C3'], arp: ['E3', 'G3', 'C4', 'E4'] },
  D: { bass: ['D2', 'D3'], arp: ['F#3', 'A3', 'D4', 'F#4'] },
  // B major and F (a semitone above the root) for menace
  B: { bass: ['B1', 'B2'], arp: ['F#3', 'B3', 'D#4', 'F#4'] },
  F: { bass: ['F2', 'F3'], arp: ['F3', 'A3', 'C4', 'F4'] },
};
const arpOrder = [0, 2, 1, 3, 0, 2, 1, 3, 0, 2, 1, 3, 2, 1, 2, 3];

// sixteenths, every note restruck
const bassBar = (chord: string) => {
  const [root, octave] = chords[chord].bass;
  return `${root} ${root} ${octave} ${root} `.repeat(4);
};
const arpBar = (chord: string) => arpOrder.map((i) => chords[chord].arp[i]).join(' ');

const phrase = ['Em', 'C', 'D', 'B', 'Em', 'F', 'Em', 'B'];
const progression = [...phrase, ...phrase];

const drums = {
  beat: 'k . h . s . h k k . h . s . h h',
  fill: 'k . h . s . h k s s s s s s s s',
};

// one bar per line: a call, then the same chords again with an answer climbing higher
const lead = `
  E5 - - - B4 - E5 - G5 - - - F#5 - E5 -  |
  E5 - - - C5 - E5 - G5 - - - A5 - G5 -   |
  F#5 - - - D5 - F#5 - A5 - - - B5 - A5 - |
  F#5 - - - - - - - D#5 - - - F#5 - - -   |
  B5 - - - G5 - - - E5 - - - G5 - B5 -    |
  C6 - - - A5 - - - F5 - - - A5 - C6 -    |
  B5 - - - G5 - E5 - G5 - B5 - E6 - - -   |
  D#6 - - - - - - - B5 - - - F#5 - D#5 -  |

  E5 - G5 - B5 - E6 - D6 - B5 - G5 - B5 -   |
  C6 - - - G5 - E5 - G5 - C6 - E6 - - -     |
  D6 - - - A5 - F#5 - A5 - D6 - F#5 - A5 -  |
  B5 - - - F#5 - D#5 - F#5 - B5 - D#6 - - - |
  E6 - - - B5 - G5 - E5 - G5 - B5 - - -     |
  F5 - A5 - C6 - F5 - A5 - C6 - F6 - - -    |
  E6 - D6 - B5 - G5 - B5 - G5 - E5 - G5 -   |
  F#5 - - - D#5 - - - B4 - - - . . . .      |
`;

export const boss: Song = {
  bpm: 150,
  stepsPerBeat: 4,
  tracks: [
    { instrument: { wave: 'square', volume: 0.08, decay: 2 }, notes: progression.map(bassBar).join(' | ') },
    { instrument: { wave: 'triangle', volume: 0.1, decay: 1.5 }, notes: progression.map(arpBar).join(' | ') },
    { instrument: { wave: 'saw', volume: 0.06, attack: 0.01, decay: 0.5 }, notes: lead },
  ],
  drums: [
    {
      kit,
      hits: [...Array(7).fill(drums.beat), drums.fill, ...Array(7).fill(drums.beat), drums.fill].join(' | '),
    },
  ],
};
