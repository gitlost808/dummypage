import { renderSong } from '../utils/tracker';
import { RenderedTrack, trackKeys, tracks } from './index';

// rendering a track takes a moment (most of a second on phones), so it happens here, off the main thread:
// receives the audio context's sample rate, answers with each track as soon as it's done
self.onmessage = ({ data: sampleRate }: MessageEvent<number>) => {
  for (const track of trackKeys) {
    const samples = renderSong(tracks[track], sampleRate);
    self.postMessage({ track, samples } satisfies RenderedTrack, { transfer: [samples.buffer] });
  }
};
