import Phaser from 'phaser';
import { Ship } from './Ship';
import { InputController } from '../input/InputController';
import { constants } from '../constants';
import { Shield } from './Shield';

export class PlayerShip extends Ship {
  private inputController: InputController;
  private shield: Shield;
  private invulnerableUntil = 0;
  private motionBlur?: Phaser.Filters.Blur;

  constructor(scene: Phaser.Scene, x: number, y: number, input: InputController) {
    super(scene, x, y, 'player', constants.playerSpeed);
    this.inputController = input;
    this.shield = new Shield(scene);
    this.setDragX(constants.playerDrag);
    this.addGlow(constants.playerColor);
    // added after the glow, so the halo smears along with the hull
    this.motionBlur = this.filters?.internal.addBlur(0, 0, 0);
    this.motionBlur?.setPaddingOverride(null);
  }

  update(): void {
    this.inputController.update();
    const speed = this.inputController.dragging ? this.followFinger() : this.steer();
    this.updateMotionBlur(speed);

    this.shield.update(this.x, this.y);
  }

  // keys: full speed while one is held; returns the speed for the motion blur
  private steer(): number {
    if (this.inputController.left) this.setVelocityX(-this.speed);
    else if (this.inputController.right) this.setVelocityX(this.speed);
    else this.setVelocityX(0);
    return Math.abs((this.body as Phaser.Physics.Arcade.Body).velocity.x);
  }

  // touch: chase the finger's x, easing in as the gap closes and never faster than
  // touchFollowMaxSpeed, so the ship glides after the finger instead of teleporting to it.
  // The position is set directly (the body syncs to it), since chasing the target with a
  // velocity overshoots whenever frames and physics steps don't line up, e.g. at 120 Hz
  private followFinger(): number {
    this.setVelocityX(0);
    const half = (this.body as Phaser.Physics.Arcade.Body).halfWidth;
    const gap = Phaser.Math.Clamp(this.inputController.targetX, half, constants.width - half) - this.x;

    const dt = this.scene.game.loop.delta / 1000;
    if (dt <= 0) return 0;
    // settle once the ship is under the finger, rather than creeping closer forever
    if (Math.abs(gap) < constants.touchFollowSnap) {
      this.x += gap;
      return 0;
    }
    // closes the same share of the gap per second at any frame rate
    const eased = gap * (1 - Math.exp(-constants.touchFollowRate * dt));
    const maxStep = constants.touchFollowMaxSpeed * dt;
    const step = Phaser.Math.Clamp(eased, -maxStep, maxStep);
    this.x += step;
    return Math.abs(step) / dt;
  }

  // blur sideways in proportion to speed; skip the pass entirely when standing still
  private updateMotionBlur(speed: number): void {
    if (!this.motionBlur) return;
    this.motionBlur.active = speed > 0;
    // touch can outrun the keys, so cap the smear at full key speed
    // Internal filter offsets use source pixels, before the sprite's scale.
    this.motionBlur.x = Math.min(speed / this.speed, 1) * constants.playerMotionBlur / Math.abs(this.scaleX);
  }

  get shieldLayers(): number {
    return this.shield.count;
  }

  get shieldFull(): boolean {
    return this.shield.count >= constants.shieldMaxLayers;
  }

  // returns false if the shield is already at full strength
  addShieldLayer(): boolean {
    return this.shield.add(this.x, this.y);
  }

  // after a shield layer breaks, hits pass straight through rather than registering as a second shield hit
  get isInvulnerable(): boolean {
    return this.scene.time.now < this.invulnerableUntil;
  }

  // returns true if the hit was absorbed by a shield layer
  absorbHit(): boolean {
    if (!this.shield.pop()) return false;

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
}
