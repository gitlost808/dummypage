// tiny tracker: turns a song written as text into one seamlessly looping buffer, using the sound effect synth
import { SoundLayer, synthesize } from './synth';

// how a melodic track sounds; the pitch and length come from its notes
export type Instrument = Pick<SoundLayer, 'wave' | 'volume' | 'attack' | 'decay'>;

// a track is a row of steps separated by whitespace: a note (`A4`, `C#5`, `Bb3`) starts playing,
// `-` holds the note before it and `.` is silence. `|` marks a bar, just for readability
export type Song = {
  bpm: number;
  stepsPerBeat: number;
  tracks: { instrument: Instrument; notes: string }[];
  // each step names a drum in the kit, or is `.` for none
  drums: { kit: Record<string, SoundLayer[]>; hits: string }[];
};

export function renderSong(song: Song, sampleRate: number): Float32Array {
  const stepSeconds = 60 / song.bpm / song.stepsPerBeat;
  const layers: SoundLayer[] = [];
  let steps = 0;

  for (const { instrument, notes } of song.tracks) {
    const tokens = tokenize(notes);
    steps = Math.max(steps, tokens.length);
    tokens.forEach((token, i) => {
      if (token === '-' || token === '.') return;
      let length = 1;
      while (tokens[i + length] === '-') length++;
      const frequency = noteFrequency(token);
      layers.push({ ...instrument, duration: length * stepSeconds, from: frequency, to: frequency, delay: i * stepSeconds });
    });
  }

  for (const { kit, hits } of song.drums) {
    const tokens = tokenize(hits);
    steps = Math.max(steps, tokens.length);
    tokens.forEach((token, i) => {
      if (token === '.') return;
      const drum = kit[token];
      if (!drum) throw new Error(`unknown drum "${token}"`);
      for (const layer of drum) layers.push({ ...layer, delay: (layer.delay ?? 0) + i * stepSeconds });
    });
  }

  // the last notes ring past the end of the song; fold them back over its start so the loop has no seam
  const mixed = synthesize(layers, sampleRate);
  const loop = new Float32Array(Math.round(steps * stepSeconds * sampleRate));
  for (let i = 0; i < mixed.length; i++) loop[i % loop.length] += mixed[i];
  for (let i = 0; i < loop.length; i++) loop[i] = Math.min(Math.max(loop[i], -1), 1);
  return loop;
}

function tokenize(text: string): string[] {
  return text.split(/\s+/).filter((token) => token && token !== '|');
}

const semitones: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

// equal temperament, A4 = 440 Hz
function noteFrequency(note: string): number {
  const match = /^([A-G])([#b]?)(\d)$/.exec(note);
  if (!match) throw new Error(`unknown note "${note}"`);
  const [, letter, accidental, octave] = match;
  const midi = 12 * (Number(octave) + 1) + semitones[letter] + (accidental === '#' ? 1 : accidental === 'b' ? -1 : 0);
  return 440 * 2 ** ((midi - 69) / 12);
}
