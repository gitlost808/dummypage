import Phaser from 'phaser';
import { generateAllTextures } from './utils/texture-generator';
import { generateAllSounds, loadMuted } from './utils/audio';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload(): void {
    generateAllTextures(this);
    generateAllSounds(this);
    this.sound.mute = loadMuted();
  }

  create(): void {
    this.scene.launch('BackgroundScene');
    this.scene.start('GameScene');
    this.input.addPointer(1);
  }
}
