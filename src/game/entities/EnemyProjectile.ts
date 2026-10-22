import Phaser from 'phaser';
import { constants } from '../constants';

export class EnemyProjectile extends Phaser.Physics.Arcade.Sprite {
  private speed = constants.enemyProjectileSpeed;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'enemy-projectile');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setCollideWorldBounds(false);
  }

  static createPool(
    scene: Phaser.Scene,
    maxSize = constants.maxProjectiles
  ): Phaser.Physics.Arcade.Group {
    return scene.physics.add.group({
      classType: EnemyProjectile,
      maxSize,
      runChildUpdate: true,
    });
  }

  // (re)activate from the pool, moving the body to the new position
  reset(x: number, y: number, vx: number, vy: number): void {
    this.enableBody(true, x, y, true, true);
    this.setVelocity(vx, vy);
  }

  update(): void {
    if (this.y > this.scene.scale.height + this.height) {
      // return to the pool
      this.disableBody(true, true);
    }
  }
}
