import Phaser from 'phaser';
import { generateAllTextures } from './utils/texture-generator';
import { generateAllSounds, generateMusic, loadMuted, loadVolume } from './utils/audio';
import { bakeGlowTextures } from './utils/glow';
import { enemyKinds } from './entities/EnemyShip';
import { Shield } from './entities/Shield';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload(): void {
    generateAllTextures(this);
    Shield.generateTextures(this);
    generateAllSounds(this);
    generateMusic(this);
    this.sound.mute = loadMuted();
    this.sound.volume = loadVolume();
  }

  create(): void {
    bakeGlowTextures(
      this,
      Object.values(enemyKinds).map(({ texture, color }) => ({ key: texture, color }))
    );
    this.scene.launch('BackgroundScene');
    this.scene.start('TitleScene');
    this.input.addPointer(1);
  }
}
