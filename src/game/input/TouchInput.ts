import Phaser from 'phaser';
import { InputController } from './InputController';
import { constants } from '../constants';

// a finger anywhere on the screen fires, and the ship chases its x (only sideways, so a finger
// below the ship never covers it). A mouse works the same way: hold the button to fire and steer
export class TouchInput implements InputController {
  // touch steers by the finger only
  public readonly left = false;
  public readonly right = false;
  public dragging = false;
  public targetX = 0;
  public fire = false;
  public firePressed = false;

  // every finger that is down; the newest one steers
  private pointers: Phaser.Input.Pointer[] = [];
  private scene: Phaser.Scene;
  private hints: Phaser.GameObjects.Text[];
  private hintShown = true;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    const { width, height } = constants;
    const touch = scene.sys.game.device.input.touch;
    const press = touch ? 'Touch' : 'Click';
    this.hints = [
      scene.add.text(width / 2, height - 90, `${press} and hold to steer`, {
        fontSize: '16px',
        color: '#ffffff',
      }).setOrigin(0.5).setDepth(6).setAlpha(0.9),
      scene.add.text(width / 2, height - 60, `Your ship follows your ${touch ? 'finger' : 'cursor'} and fires`, {
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
    // only the primary mouse button; a touch reports button 0 too
    if (p.button !== 0) return;

    this.pointers.push(p);
    this.steerWith(p);
    this.dragging = this.fire = true;
    this.firePressed = true;
    this.fadeHints();
  }

  private onMove(p: Phaser.Input.Pointer) {
    if (p === this.steering) this.steerWith(p);
  }

  private onUp(p: Phaser.Input.Pointer) {
    // the mouse is one pointer for all buttons, so releasing another button mustn't end the drag
    if (p.button !== 0) return;
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

  // forget every finger: one lifted while the scene was paused never sends its pointerup here
  public release(): void {
    this.pointers = [];
    this.dragging = this.fire = this.firePressed = false;
  }

  private get steering(): Phaser.Input.Pointer | undefined {
    return this.pointers[this.pointers.length - 1];
  }

  private steerWith(p: Phaser.Input.Pointer): void {
    this.targetX = this.toPlayfieldX(p);
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
