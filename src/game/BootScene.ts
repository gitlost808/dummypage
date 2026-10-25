import Phaser from 'phaser';
import { generateAllTextures } from './utils/texture-generator';
import { generateAllSounds, generateMusic, loadMuted } from './utils/audio';
import { bakeGlowTextures } from './utils/glow';
import { enemyKinds } from './entities/EnemyShip';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload(): void {
    generateAllTextures(this);
    generateAllSounds(this);
    generateMusic(this);
    this.sound.mute = loadMuted();
  }

  create(): void {
    bakeGlowTextures(
      this,
      Object.values(enemyKinds).map(({ texture, color }) => ({ key: texture, color }))
    );
    this.scene.launch('BackgroundScene');
    this.scene.start('GameScene');
    this.input.addPointer(1);
  }
}
