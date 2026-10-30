import Phaser from 'phaser';
import { constants } from '../constants';
import { spriteSizes } from '../utils/texture-resolution';

export type EnemyProjectileTexture = 'enemy-projectile' | 'enemy-projectile-aimed' | 'boss-projectile';

export class EnemyProjectile extends Phaser.Physics.Arcade.Sprite {
  private speed = constants.enemyProjectileSpeed;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'enemy-projectile');
    const { width, height } = spriteSizes['enemy-projectile'];
    this.setDisplaySize(width, height);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    (this.body as Phaser.Physics.Arcade.Body).setSize(width / this.scaleX, height / this.scaleY);
    this.setCollideWorldBounds(false);
  }

  static createPool(
    scene: Phaser.Scene,
    maxSize = constants.maxEnemyProjectiles
  ): Phaser.Physics.Arcade.Group {
    return scene.physics.add.group({
      classType: EnemyProjectile,
      maxSize,
      runChildUpdate: true,
    });
  }

  // (re)activate from the pool, moving the body to the new position
  reset(x: number, y: number, vx: number, vy: number, texture: EnemyProjectileTexture = 'enemy-projectile'): void {
    // Pooled bullets can change kind; reset the display and hitbox together.
    const { width, height } = spriteSizes[texture];
    this.setTexture(texture).setDisplaySize(width, height);
    (this.body as Phaser.Physics.Arcade.Body).setSize(width / this.scaleX, height / this.scaleY);
    this.enableBody(true, x, y, true, true);
    this.setVelocity(vx, vy);
  }

  update(): void {
    // aimed shots can leave through the sides and boss rings through the top; nothing clips the
    // playfield, so recycle them there
    if (
      this.y > constants.height + this.displayHeight ||
      this.y < -this.displayHeight ||
      this.x < 0 ||
      this.x > constants.width
    ) {
      // return to the pool
      this.disableBody(true, true);
    }
  }
}
