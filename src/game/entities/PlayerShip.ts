import Phaser from 'phaser';
import { Ship } from './Ship';
import { InputController } from '../input/InputController';
import { constants } from '../constants';

export class PlayerShip extends Ship {
  private inputController: InputController;
  private shield?: Phaser.GameObjects.Arc;
  private invulnerableUntil = 0;
  private motionBlur?: Phaser.Filters.Blur;
  // where a touch drag is taking the ship (playfield x)
  private dragTargetX = 0;
  private wasDragging = false;

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
    const speed = this.inputController.dragging ? this.followDrag() : this.steer();
    this.updateMotionBlur(speed);

    this.shield?.setPosition(this.x, this.y);
  }

  // keys: full speed while one is held; returns the speed for the motion blur
  private steer(): number {
    this.wasDragging = false;
    this.inputController.dragX = 0;
    if (this.inputController.left) this.setVelocityX(-this.speed);
    else if (this.inputController.right) this.setVelocityX(this.speed);
    else this.setVelocityX(0);
    return Math.abs((this.body as Phaser.Physics.Arcade.Body).velocity.x);
  }

  // touch: move by the finger's travel, gliding there no faster than touchFollowMaxSpeed.
  // The position is set directly (the body syncs to it), since chasing the target with a
  // velocity overshoots whenever frames and physics steps don't line up, e.g. at 120 Hz
  private followDrag(): number {
    if (!this.wasDragging) {
      this.wasDragging = true;
      this.dragTargetX = this.x;
    }
    // clamped to the playfield, so dragging past an edge doesn't build up slack to drag back
    const half = (this.body as Phaser.Physics.Arcade.Body).halfWidth;
    this.dragTargetX = Phaser.Math.Clamp(
      this.dragTargetX + this.inputController.dragX,
      half,
      constants.width - half
    );
    this.inputController.dragX = 0;
    this.setVelocityX(0);

    const dt = this.scene.game.loop.delta / 1000;
    if (dt <= 0) return 0;
    const maxStep = constants.touchFollowMaxSpeed * dt;
    const step = Phaser.Math.Clamp(this.dragTargetX - this.x, -maxStep, maxStep);
    this.x += step;
    return Math.abs(step) / dt;
  }

  // blur sideways in proportion to speed; skip the pass entirely when standing still
  private updateMotionBlur(speed: number): void {
    if (!this.motionBlur) return;
    this.motionBlur.active = speed > 0;
    // touch can outrun the keys, so cap the smear at full key speed
    this.motionBlur.x = Math.min(speed / this.speed, 1) * constants.playerMotionBlur;
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
