import { music } from './music';
import { renderSong } from './tracker';

// rendering the song takes a moment (most of a second on phones), so it happens here, off the main thread:
// receives the audio context's sample rate, answers with the samples
self.onmessage = ({ data: sampleRate }: MessageEvent<number>) => {
  const samples = renderSong(music, sampleRate);
  self.postMessage(samples, { transfer: [samples.buffer] });
};
