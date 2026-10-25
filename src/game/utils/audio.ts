import Phaser from 'phaser';
import { constants } from '../constants';
import { synthesize } from './synth';
import { sounds, SoundKey } from './sounds';
import { RenderedTrack, trackKeys, TrackKey } from '../music';

const mutedKey = 'galactic-skirmish:muted';
const musicOffKey = 'galactic-skirmish:music-off';

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

// the track that should be playing (none between runs), so it can start as soon as it's rendered
let wantedTrack: TrackKey | null = null;
// the music's own switch; it keeps playing muted, so switching it back on doesn't restart it
let musicOff = loadFlag(musicOffKey);

const musicKey = (track: TrackKey) => `music:${track}`;

// render the music tracks in a worker and add each to the audio cache once it's ready
export function generateMusic(scene: Phaser.Scene): void {
  if (!(scene.sound instanceof Phaser.Sound.WebAudioSoundManager)) return;
  const context = scene.sound.context;
  const sound = scene.sound;
  const cache = scene.cache.audio;
  let pending = trackKeys.length;

  // if the worker can't run, the game just plays without music
  const worker = new Worker(new URL('../music/worker.ts', import.meta.url), { type: 'module' });
  worker.onerror = () => worker.terminate();
  worker.onmessage = ({ data: { track, samples } }: MessageEvent<RenderedTrack>) => {
    if (--pending === 0) worker.terminate();
    const buffer = context.createBuffer(1, samples.length, context.sampleRate);
    buffer.copyToChannel(samples, 0);
    cache.add(musicKey(track), buffer);
    if (track === wantedTrack) startTrack(sound, track, false);
  };
  worker.postMessage(context.sampleRate);
}

// switch to a track, from the top. Without a transition the others just stop (a new run); with one, the
// playing track winds down like a tape stopping while the new one fades in. Tweens run even while the scene
// clock is paused on game over. A track that hasn't rendered yet starts once it has
export function playMusic(scene: Phaser.Scene, track: TrackKey, transition = false): void {
  wantedTrack = track;
  for (const other of trackKeys) if (other !== track) silence(scene, other, transition);
  if (!scene.cache.audio.exists(musicKey(track))) return;

  const music = startTrack(scene.sound, track, transition);
  scene.tweens.killTweensOf(music);
  if (transition) scene.tweens.add({ targets: music, volume: constants.musicVolume, duration: constants.musicTransitionMs });
}

export function stopMusic(scene: Phaser.Scene): void {
  wantedTrack = null;
  for (const track of trackKeys) silence(scene, track, true);
}

export function isMusicOn(): boolean {
  return !musicOff;
}

export function toggleMusic(scene: Phaser.Scene): void {
  musicOff = !musicOff;
  saveFlag(musicOffKey, musicOff);
  for (const track of trackKeys) scene.sound.get<Phaser.Sound.WebAudioSound>(musicKey(track))?.setMute(musicOff);
}

function startTrack(sound: Phaser.Sound.BaseSoundManager, track: TrackKey, silent: boolean): Phaser.Sound.BaseSound {
  const music = sound.get(musicKey(track)) ?? sound.add(musicKey(track));
  // a wound-down track was left slowed, so reset the rate too
  music.play({ loop: true, volume: silent ? 0 : constants.musicVolume, rate: 1, mute: musicOff });
  return music;
}

function silence(scene: Phaser.Scene, track: TrackKey, windDown: boolean): void {
  const music = scene.sound.get<Phaser.Sound.WebAudioSound>(musicKey(track));
  if (!music?.isPlaying) return;
  scene.tweens.killTweensOf(music);
  if (!windDown) {
    music.stop();
    return;
  }
  scene.tweens.add({
    targets: music,
    volume: 0,
    rate: constants.musicWindDownRate,
    duration: constants.musicTransitionMs,
    onComplete: () => music.stop(),
  });
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

// a sound that repeats until its owner stops it; undefined without Web Audio
export function loopSound(scene: Phaser.Scene, key: SoundKey): Phaser.Sound.BaseSound | undefined {
  if (!scene.cache.audio.exists(key)) return undefined;
  // the sound manager outlives scene restarts, like the music
  return scene.sound.get(key) ?? scene.sound.add(key, { loop: true, volume: constants.soundVolume });
}

// slight random pitch variation so repeated sounds don't feel mechanical
export function randomDetune(): Phaser.Types.Sound.SoundConfig {
  return { detune: Phaser.Math.Between(-constants.soundDetuneCents, constants.soundDetuneCents) };
}

export const loadMuted = () => loadFlag(mutedKey);
export const saveMuted = (muted: boolean) => saveFlag(mutedKey, muted);

// storage can be unavailable (private mode, blocked site data), so never throw
function loadFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === 'true';
  } catch {
    return false;
  }
}

function saveFlag(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // ignore, the setting just won't survive a reload
  }
}
