import { Song } from '../utils/tracker';
import { main } from './main';
import { boss } from './boss';

// every music track, rendered in this order at boot (see worker.ts), so the main theme is ready first
export const tracks = { main, boss } satisfies Record<string, Song>;

export type TrackKey = keyof typeof tracks;

export const trackKeys = Object.keys(tracks) as TrackKey[];

// what the worker sends back for each track
export type RenderedTrack = { track: TrackKey; samples: Float32Array<ArrayBuffer> };
