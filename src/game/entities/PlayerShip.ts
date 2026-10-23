import { Ship } from './Ship';
import { InputController } from '../input/InputController';
import { constants } from '../constants';

export class PlayerShip extends Ship {
  private inputController: InputController;
  private shield?: Phaser.GameObjects.Arc;
  private invulnerableUntil = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, input: InputController) {
    super(scene, x, y, 'player', constants.playerSpeed);
    this.inputController = input;
    this.setDragX(constants.playerDrag);
  }

  update(): void {
    this.inputController.update();
    if (this.inputController.left) this.setVelocityX(-this.speed);
    else if (this.inputController.right) this.setVelocityX(this.speed);
    else this.setVelocityX(0);

    this.shield?.setPosition(this.x, this.y);
  }

  activateShield(): void {
    if (this.shield) return;
    this.shield = this.scene.add
      .circle(this.x, this.y, 24)
      .setStrokeStyle(2, constants.shieldColor, 0.9);
    this.scene.tweens.add({
      targets: this.shield,
      alpha: 0.4,
      duration: 500,
      yoyo: true,
      repeat: -1,
    });
  }

  // returns true if the hit was absorbed by the shield (or post-hit invulnerability)
  absorbHit(): boolean {
    if (this.scene.time.now < this.invulnerableUntil) return true;
    if (!this.shield) return false;

    this.breakShield();
    this.invulnerableUntil = this.scene.time.now + constants.shieldInvulnerabilityMs;
    this.scene.tweens.add({
      targets: this,
      alpha: 0.3,
      duration: 100,
      yoyo: true,
      repeat: Math.floor(constants.shieldInvulnerabilityMs / 200) - 1,
      onComplete: () => this.setAlpha(1),
    });
    return true;
  }

  private breakShield(): void {
    const shield = this.shield;
    if (!shield) return;
    this.shield = undefined;

    this.scene.tweens.killTweensOf(shield);
    this.scene.tweens.add({
      targets: shield,
      scale: 1.8,
      alpha: 0,
      duration: 250,
      onComplete: () => shield.destroy(),
    });
  }
}
