import Phaser from 'phaser';
import { constants } from '../constants';
import { LegendEntry } from './LegendEntry';

export type PowerUpType = 'shield' | 'spread' | 'bomb';

// every power-up; the title screen legend lists them all. What each one does is in PowerUpSystem.collect
export const powerUpKinds: Record<PowerUpType, LegendEntry> = {
  shield: {
    name: 'Shield',
    description: `Absorbs a hit. Stacks up to ${constants.shieldMaxLayers} layers`,
    texture: 'powerup-shield',
    color: constants.shieldColor,
  },
  spread: {
    name: 'Spread',
    description: `Fires three shots at once for ${constants.spreadDurationMs / 1000}s`,
    texture: 'powerup-spread',
    color: constants.spreadColor,
  },
  bomb: {
    name: 'Bomb',
    description: 'Clears the screen and hurts the boss',
    texture: 'powerup-bomb',
    color: constants.bombColor,
  },
};

export class PowerUp extends Phaser.Physics.Arcade.Sprite {
  public readonly powerUpType: PowerUpType;

  constructor(scene: Phaser.Scene, x: number, y: number, type: PowerUpType) {
    super(scene, x, y, powerUpKinds[type].texture);
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
    if (this.y > constants.height + this.height) this.destroy();
  }
}
