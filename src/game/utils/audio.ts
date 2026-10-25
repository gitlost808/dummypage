import Phaser from 'phaser';
import { constants } from '../constants';
import { synthesize } from './synth';
import { sounds, SoundKey } from './sounds';

const mutedKey = 'galactic-skirmish:muted';

// synthesize every sound into the audio cache, like generateAllTextures does for textures
export function generateAllSounds(scene: Phaser.Scene): void {
  // generated buffers need Web Audio; without it the game simply stays silent
  if (!(scene.sound instanceof Phaser.Sound.WebAudioSoundManager)) return;
  const context = scene.sound.context;

  for (const [key, layers] of Object.entries(sounds)) {
    const samples = synthesize(layers, context.sampleRate);
    const buffer = context.createBuffer(1, samples.length, context.sampleRate);
    buffer.copyToChannel(samples, 0);
    scene.cache.audio.add(key, buffer);
  }
}

const musicKey = 'music';
// whether a run is under way, so the music can start as soon as it's rendered
let musicWanted = false;

// render the background music in a worker and add it to the audio cache once it's ready
export function generateMusic(scene: Phaser.Scene): void {
  if (!(scene.sound instanceof Phaser.Sound.WebAudioSoundManager)) return;
  const context = scene.sound.context;
  const sound = scene.sound;
  const cache = scene.cache.audio;

  // if the worker can't run, the game just plays without music
  const worker = new Worker(new URL('./music-worker.ts', import.meta.url), { type: 'module' });
  worker.onerror = () => worker.terminate();
  worker.onmessage = ({ data: samples }: MessageEvent<Float32Array<ArrayBuffer>>) => {
    worker.terminate();
    const buffer = context.createBuffer(1, samples.length, context.sampleRate);
    buffer.copyToChannel(samples, 0);
    cache.add(musicKey, buffer);
    if (musicWanted) playMusic(sound);
  };
  worker.postMessage(context.sampleRate);
}

// (re)start the music from the top; before it has rendered, it starts once it has
export function startMusic(scene: Phaser.Scene): void {
  musicWanted = true;
  if (scene.cache.audio.exists(musicKey)) playMusic(scene.sound);
}

function playMusic(sound: Phaser.Sound.BaseSoundManager): void {
  const music = sound.get(musicKey) ?? sound.add(musicKey);
  music.play({ loop: true, volume: constants.musicVolume });
}

// fade out; tweens run even while the scene clock is paused on game over
export function stopMusic(scene: Phaser.Scene): void {
  musicWanted = false;
  const music = scene.sound.get<Phaser.Sound.WebAudioSound>(musicKey);
  if (!music?.isPlaying) return;
  scene.tweens.add({ targets: music, volume: 0, duration: constants.musicFadeOutMs, onComplete: () => music.stop() });
}

const lastPlayedAt = new Map<SoundKey, number>();

export function playSound(scene: Phaser.Scene, key: SoundKey, config: Phaser.Types.Sound.SoundConfig = {}): void {
  if (!scene.cache.audio.exists(key)) return;

  // the same sound several times in one moment (bombs, spread hits) only gets louder, not better
  const now = scene.game.loop.time;
  if (now - (lastPlayedAt.get(key) ?? -Infinity) < constants.soundMinIntervalMs) return;
  lastPlayedAt.set(key, now);

  scene.sound.play(key, { volume: constants.soundVolume, ...config });
}

// slight random pitch variation so repeated sounds don't feel mechanical
export function randomDetune(): Phaser.Types.Sound.SoundConfig {
  return { detune: Phaser.Math.Between(-constants.soundDetuneCents, constants.soundDetuneCents) };
}

// storage can be unavailable (private mode, blocked site data), so never throw
export function loadMuted(): boolean {
  try {
    return localStorage.getItem(mutedKey) === 'true';
  } catch {
    return false;
  }
}

export function saveMuted(muted: boolean): void {
  try {
    localStorage.setItem(mutedKey, String(muted));
  } catch {
    // ignore, the setting just won't survive a reload
  }
}
