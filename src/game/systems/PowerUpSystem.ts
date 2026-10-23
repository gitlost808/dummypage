import Phaser from 'phaser';
import { constants } from '../constants';
import { PowerUp, PowerUpType } from '../entities/PowerUp';
import { PlayerShip } from '../entities/PlayerShip';
import { playSound } from '../utils/audio';

const powerUpColors: Record<PowerUpType, number> = {
  shield: constants.shieldColor,
  spread: constants.spreadColor,
  bomb: constants.bombColor,
};

const toHex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

export class PowerUpSystem {
  private scene: Phaser.Scene;
  private player: PlayerShip;
  private powerUps: Phaser.Physics.Arcade.Group;
  private statusText: Phaser.GameObjects.Text;
  private onBomb: () => void;

  private spreadEndsAt = 0;

  constructor(scene: Phaser.Scene, player: PlayerShip, onBomb: () => void) {
    this.scene = scene;
    this.player = player;
    this.onBomb = onBomb;

    this.powerUps = scene.physics.add.group({ runChildUpdate: true });

    this.statusText = scene.add.text(10, 70, '', {
      fontSize: '20px',
      color: toHex(constants.spreadColor),
    });

    scene.physics.add.overlap(player, this.powerUps, (_player, powerUp) =>
      this.collect(powerUp as PowerUp)
    );
  }

  public maybeDrop(x: number, y: number): void {
    if (Math.random() >= constants.powerUpDropChance) return;
    this.powerUps.add(new PowerUp(this.scene, x, y, this.pickType()));
  }

  public isSpreadActive(): boolean {
    return this.scene.time.now < this.spreadEndsAt;
  }

  update(): void {
    const remaining = this.spreadEndsAt - this.scene.time.now;
    this.statusText.setText(
      remaining > 0 ? `Spread: ${Math.ceil(remaining / 1000)}s` : ''
    );
  }

  private collect(powerUp: PowerUp): void {
    const type = powerUp.powerUpType;
    const { x, y } = powerUp;
    powerUp.destroy();
    playSound(this.scene, 'powerup');

    switch (type) {
      case 'shield':
        this.player.activateShield();
        break;
      case 'spread':
        this.spreadEndsAt = this.scene.time.now + constants.spreadDurationMs;
        break;
      case 'bomb':
        this.onBomb();
        break;
    }

    this.showLabel(x, y, type.toUpperCase(), powerUpColors[type]);
  }

  private showLabel(x: number, y: number, text: string, color: number): void {
    const label = this.scene.add
      .text(x, y, text, { fontSize: '16px', color: toHex(color) })
      .setOrigin(0.5);
    this.scene.tweens.add({
      targets: label,
      y: y - 40,
      alpha: 0,
      duration: 800,
      onComplete: () => label.destroy(),
    });
  }

  private pickType(): PowerUpType {
    const weights = constants.powerUpWeights;
    const total = weights.shield + weights.spread + weights.bomb;
    const roll = Math.random() * total;

    if (roll < weights.shield) return 'shield';
    if (roll < weights.shield + weights.spread) return 'spread';
    return 'bomb';
  }
}
