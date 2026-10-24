import Phaser from 'phaser';
import { constants } from '../constants';

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

  // soft neon halo; filters are WebGL only, so ships stay plain under the canvas renderer
  protected addGlow(color: number): void {
    if (!this.enableFilters().filters) return;
    // pad automatically, so the halo isn't clipped at the texture edge
    this.glow = this.filters.internal.addGlow(
      color,
      constants.shipGlowStrength,
      0,
      constants.shipGlowScale
    );
    this.glow.setPaddingOverride(null);
  }

  protected preDestroy(): void {};
}
