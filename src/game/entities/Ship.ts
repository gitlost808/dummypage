import Phaser from 'phaser';
import { addShipGlow } from '../utils/glow';

export abstract class Ship extends Phaser.Physics.Arcade.Sprite {
  protected speed: number;
  protected glow?: Phaser.Filters.Glow;

  constructor(scene: Phaser.Scene, x: number, y: number, texture: string, speed: number) {
    super(scene, x, y, texture);
    this.speed = speed;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setCollideWorldBounds(true);
  }

  abstract update(): void;

  // a live glow, for the few ships that need one; enemies use baked glows (see bakeGlowTextures)
  protected addGlow(color: number): void {
    this.glow = addShipGlow(this, color);
  }

  protected preDestroy(): void {};
}
