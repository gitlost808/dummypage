import Phaser from 'phaser';
import { constants } from '../constants';

export abstract class Ship extends Phaser.Physics.Arcade.Sprite {
  protected speed: number;
  protected glow?: Phaser.FX.Glow;

  constructor(scene: Phaser.Scene, x: number, y: number, texture: string, speed: number) {
    super(scene, x, y, texture);
    this.speed = speed;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setCollideWorldBounds(true);
  }

  abstract update(): void;

  // soft neon halo; preFX is null under the canvas renderer, so ships stay plain there
  protected addGlow(color: number): void {
    if (!this.preFX) return;
    this.preFX.setPadding(constants.shipFxPadding);
    this.glow = this.preFX.addGlow(color, constants.shipGlowStrength, 0);
  }

  protected preDestroy(): void {};
}
