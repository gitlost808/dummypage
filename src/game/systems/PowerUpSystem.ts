import Phaser from 'phaser';
import { constants } from '../constants';
import { PowerUp, PowerUpType, TimedPowerUp, powerUpKinds } from '../entities/PowerUp';
import { PlayerShip } from '../entities/PlayerShip';
import { playSound } from '../utils/audio';
import { scale } from './EnemySpawner';

const toHex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

export class PowerUpSystem {
  private scene: Phaser.Scene;
  private player: PlayerShip;
  private powerUps: Phaser.Physics.Arcade.Group;
  // a countdown line under the score for each timed power-up that's running
  private statusTexts: Record<TimedPowerUp, Phaser.GameObjects.Text>;
  private onBomb: () => void;
  private getDifficulty: () => number;

  private endsAt: Record<TimedPowerUp, number> = { spread: 0, laser: 0 };

  constructor(scene: Phaser.Scene, player: PlayerShip, getDifficulty: () => number, onBomb: () => void) {
    this.scene = scene;
    this.player = player;
    this.getDifficulty = getDifficulty;
    this.onBomb = onBomb;

    this.powerUps = scene.physics.add.group({ runChildUpdate: true });

    const statusText = (type: TimedPowerUp) =>
      scene.add.text(10, 0, '', { fontSize: '20px', color: toHex(powerUpKinds[type].color) });
    this.statusTexts = { spread: statusText('spread'), laser: statusText('laser') };

    scene.physics.add.overlap(player, this.powerUps, (_player, powerUp) =>
      this.collect(powerUp as PowerUp)
    );
  }

  public maybeDrop(x: number, y: number): void {
    if (Math.random() >= scale(constants.powerUpDropChance, this.getDifficulty())) return;
    const type = this.pickType();
    // shields thin out as they stack, so spare layers stay rare, and stop once the shield is full;
    // the other odds don't change
    const skipChance = this.player.shieldLayers * constants.shieldDropFalloffPerLayer;
    if (type === 'shield' && (this.player.shieldFull || Math.random() < skipChance)) return;
    this.powerUps.add(new PowerUp(this.scene, x, y, type));
  }

  // a guaranteed drop: a random one never rolls a shield the player can't use, and a requested
  // shield is skipped when the shield is already full
  public drop(x: number, y: number, type = this.pickType(this.player.shieldFull)): void {
    if (type === 'shield' && this.player.shieldFull) return;
    this.powerUps.add(new PowerUp(this.scene, x, y, type));
  }

  public isActive(type: TimedPowerUp): boolean {
    return this.scene.time.now < this.endsAt[type];
  }

  update(): void {
    // running countdowns stack downwards, with no gap for the ones that aren't
    let y = 70;
    for (const [type, text] of Object.entries(this.statusTexts) as [TimedPowerUp, Phaser.GameObjects.Text][]) {
      const remaining = this.endsAt[type] - this.scene.time.now;
      text.setText(remaining > 0 ? `${powerUpKinds[type].name}: ${Math.ceil(remaining / 1000)}s` : '');
      text.setY(y);
      if (remaining > 0) y += text.height;
    }
  }

  private collect(powerUp: PowerUp): void {
    const type = powerUp.powerUpType;
    const { x, y } = powerUp;
    powerUp.destroy();
    playSound(this.scene, 'powerup');

    let label = type.toUpperCase();
    switch (type) {
      case 'shield':
        label = this.player.addShieldLayer()
          ? `${label} ${this.player.shieldLayers}/${constants.shieldMaxLayers}`
          : `${label} MAX`;
        break;
      case 'spread':
        this.endsAt.spread = this.scene.time.now + constants.spreadDurationMs;
        break;
      case 'laser':
        this.endsAt.laser = this.scene.time.now + constants.laserDurationMs;
        break;
      case 'bomb':
        this.onBomb();
        break;
    }

    this.showLabel(x, y, label, powerUpKinds[type].color);
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

  private pickType(withoutShield = false): PowerUpType {
    const weights = (Object.entries(constants.powerUpWeights) as [PowerUpType, number][]).filter(
      ([type]) => !(withoutShield && type === 'shield')
    );
    let roll = Math.random() * weights.reduce((total, [, weight]) => total + weight, 0);
    for (const [type, weight] of weights) {
      roll -= weight;
      if (roll < 0) return type;
    }
    // only reached through rounding
    return weights[weights.length - 1][0];
  }
}
