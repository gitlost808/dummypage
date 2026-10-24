import { Ship } from './Ship';
import { InputController } from '../input/InputController';
import { constants } from '../constants';

export class PlayerShip extends Ship {
  private inputController: InputController;
  private shield?: Phaser.GameObjects.Arc;
  private invulnerableUntil = 0;
  private motionBlur?: Phaser.Filters.Blur;

  constructor(scene: Phaser.Scene, x: number, y: number, input: InputController) {
    super(scene, x, y, 'player', constants.playerSpeed);
    this.inputController = input;
    this.setDragX(constants.playerDrag);
    this.addGlow(constants.playerColor);
    // added after the glow, so the halo smears along with the hull
    this.motionBlur = this.filters?.internal.addBlur(0, 0, 0);
    this.motionBlur?.setPaddingOverride(null);
  }

  update(): void {
    this.inputController.update();
    if (this.inputController.left) this.setVelocityX(-this.speed);
    else if (this.inputController.right) this.setVelocityX(this.speed);
    else this.setVelocityX(0);
    this.updateMotionBlur();

    this.shield?.setPosition(this.x, this.y);
  }

  // blur sideways in proportion to speed; skip the pass entirely when standing still
  private updateMotionBlur(): void {
    if (!this.motionBlur) return;
    const vx = (this.body as Phaser.Physics.Arcade.Body).velocity.x;
    this.motionBlur.active = vx !== 0;
    this.motionBlur.x = (Math.abs(vx) / this.speed) * constants.playerMotionBlur;
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

  // after the shield breaks, hits pass straight through rather than registering as a second shield hit
  get isInvulnerable(): boolean {
    return this.scene.time.now < this.invulnerableUntil;
  }

  // returns true if the hit was absorbed by the shield
  absorbHit(): boolean {
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
