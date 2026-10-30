import Phaser from 'phaser';
import { constants } from '../constants';
import { spriteSizes } from '../utils/texture-resolution';

export class Projectile extends Phaser.Physics.Arcade.Sprite {
  private speed = constants.projectileSpeed;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'projectile');
    const { width, height } = spriteSizes.projectile;
    this.setDisplaySize(width, height);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    (this.body as Phaser.Physics.Arcade.Body).setSize(width / this.scaleX, height / this.scaleY);
    this.setCollideWorldBounds(false);
  }

  static createPool(
    scene: Phaser.Scene,
    maxSize = constants.maxProjectiles
  ): Phaser.Physics.Arcade.Group {
    return scene.physics.add.group({
      classType: Projectile,
      maxSize,
      runChildUpdate: true,
    });
  }

  // (re)activate from the pool, moving the body to the new position
  reset(x: number, y: number, vx = 0): void {
    this.enableBody(true, x, y, true, true);
    this.setVelocityX(vx);
    this.setRotation(Math.atan2(vx, this.speed));
  }

  update(): void {
    this.setVelocityY(-this.speed);
    // spread shots leave through the sides; nothing clips the playfield, so recycle them there
    if (this.y < -this.displayHeight || this.x < 0 || this.x > constants.width) this.disableBody(true, true);
  }
}
