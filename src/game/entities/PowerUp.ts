import Phaser from 'phaser';
import { constants } from '../constants';

export type PowerUpType = 'shield' | 'spread' | 'bomb';

export class PowerUp extends Phaser.Physics.Arcade.Sprite {
  public readonly powerUpType: PowerUpType;

  constructor(scene: Phaser.Scene, x: number, y: number, type: PowerUpType) {
    super(scene, x, y, `powerup-${type}`);
    this.powerUpType = type;
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // gentle pulse so pickups stand out from enemies
    scene.tweens.add({
      targets: this,
      scale: 1.15,
      duration: 400,
      yoyo: true,
      repeat: -1,
    });
    this.once(Phaser.GameObjects.Events.DESTROY, () =>
      scene.tweens.killTweensOf(this)
    );
  }

  update(): void {
    this.setVelocityY(constants.powerUpSpeed);
    if (this.y > this.scene.scale.height + this.height) this.destroy();
  }
}
