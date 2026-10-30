import Phaser from 'phaser';
import { addShipGlow } from '../utils/glow';
import { spriteSizes, SpriteTexture } from '../utils/texture-resolution';

export abstract class Ship extends Phaser.Physics.Arcade.Sprite {
  protected speed: number;
  protected glow?: Phaser.Filters.Glow;

  constructor(scene: Phaser.Scene, x: number, y: number, texture: SpriteTexture, speed: number) {
    super(scene, x, y, texture);
    this.speed = speed;
    const { width, height } = spriteSizes[texture];
    this.setDisplaySize(width, height);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    // Arcade body sizes use source pixels, then follow the sprite's scale.
    (this.body as Phaser.Physics.Arcade.Body).setSize(width / this.scaleX, height / this.scaleY);
    this.setCollideWorldBounds(true);
  }

  abstract update(): void;

  // a live glow, for the few ships that need one; enemies use baked glows (see bakeGlowTextures)
  protected addGlow(color: number): void {
    this.glow = addShipGlow(this, color);
  }

  protected preDestroy(): void {};
}
