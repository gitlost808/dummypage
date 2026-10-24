import Phaser from 'phaser';
import { InputController } from './InputController';
import { constants } from '../constants';

// a finger anywhere on the screen fires, and dragging it moves the ship by the same distance
// (relative, so the finger never has to cover the ship)
export class TouchInput implements InputController {
  // touch steers by dragging only
  public readonly left = false;
  public readonly right = false;
  public dragging = false;
  public dragX = 0;
  public fire = false;
  public firePressed = false;

  // every finger that is down; the newest one steers
  private pointers: Phaser.Input.Pointer[] = [];
  // playfield x of the steering finger when its travel was last counted
  private lastX = 0;
  private scene: Phaser.Scene;
  private hints: Phaser.GameObjects.Text[];
  private hintShown = true;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    const { width, height } = constants;
    this.hints = [
      scene.add.text(width / 2, height - 90, 'Touch and drag to move', {
        fontSize: '16px',
        color: '#ffffff',
      }).setOrigin(0.5).setDepth(6).setAlpha(0.9),
      scene.add.text(width / 2, height - 60, 'Your ship fires while you hold', {
        fontSize: '14px',
        color: '#cccccc',
      }).setOrigin(0.5).setDepth(6).setAlpha(0.85),
    ];

    scene.input.on('pointerdown', this.onDown, this);
    scene.input.on('pointermove', this.onMove, this);
    scene.input.on('pointerup', this.onUp, this);
    scene.input.on('pointerupoutside', this.onUp, this);
  }

  private onDown(p: Phaser.Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[]) {
    // ignore taps on UI such as the mute button
    if (currentlyOver.length > 0) return;

    this.pointers.push(p);
    this.steerWith(p);
    this.dragging = this.fire = true;
    this.firePressed = true;
    this.fadeHints();
  }

  private onMove(p: Phaser.Input.Pointer) {
    if (p !== this.steering) return;
    const x = this.toPlayfieldX(p);
    this.dragX += (x - this.lastX) * constants.touchDragSensitivity;
    this.lastX = x;
  }

  private onUp(p: Phaser.Input.Pointer) {
    const index = this.pointers.indexOf(p);
    if (index === -1) return;
    const wasSteering = p === this.steering;
    this.pointers.splice(index, 1);

    const next = this.steering;
    if (wasSteering && next) this.steerWith(next);
    this.dragging = this.fire = next !== undefined;
  }

  update(): void {
    // all state is event-driven
  }

  private get steering(): Phaser.Input.Pointer | undefined {
    return this.pointers[this.pointers.length - 1];
  }

  // count travel from where this finger is now, so switching fingers doesn't jump the ship
  private steerWith(p: Phaser.Input.Pointer): void {
    this.lastX = this.toPlayfieldX(p);
  }

  // pointer positions are in screen pixels; the ship moves in the scaled playfield
  private toPlayfieldX(p: Phaser.Input.Pointer): number {
    return this.scene.cameras.main.getWorldPoint(p.x, p.y).x;
  }

  public fadeHints(): void {
    if (!this.hintShown) return;
    this.hintShown = false;
    this.scene.tweens.add({
      targets: this.hints,
      alpha: 0,
      duration: 500,
      delay: 300,
    });
  }
}
