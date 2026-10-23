import Phaser from 'phaser';
import { InputController } from './InputController';
import { constants } from '../constants';

export class TouchInput implements InputController {
  public left = false;
  public right = false;
  public fire = false;
  public firePressed = false;

  private activePointer: Phaser.Input.Pointer | null = null;
  // pointers held down on the shooting half (multitouch: move + shoot at once)
  private firePointers = new Set<Phaser.Input.Pointer>();
  private originX = 0;
  private scene: Phaser.Scene;
  private originMarker?: Phaser.GameObjects.Container;
  private originHandle?: Phaser.GameObjects.Arc;
  private hintText: Phaser.GameObjects.Text;
  private leftHint: Phaser.GameObjects.Text;
  private rightHint: Phaser.GameObjects.Text;
  private divider: Phaser.GameObjects.Rectangle;
  private hintShown = true;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    // visual guidance for touch controls
    const { width, height } = scene.scale;
    this.divider = scene.add.rectangle(width / 2, height / 2, 2, height, 0xffffff, 0.12).setDepth(5);
    this.leftHint = scene.add.text(width * 0.25, height - 90, 'Swipe here to move', {
      fontSize: '16px',
      color: '#ffffff',
    }).setOrigin(0.5).setDepth(6).setAlpha(0.9);

    this.rightHint = scene.add.text(width * 0.75, height - 90, 'Hold here to shoot', {
      fontSize: '16px',
      color: '#ffffff',
    }).setOrigin(0.5).setDepth(6).setAlpha(0.9);

    this.hintText = scene.add.text(width / 2, height - 50, 'Touch controls: left = move, right = shoot', {
      fontSize: '14px',
      color: '#cccccc',
    }).setOrigin(0.5).setDepth(6).setAlpha(0.85);

    this.layoutHints(width, height);

    // the ScaleManager outlives the scene, so detach on shutdown/restart
    scene.scale.on('resize', this.onResize, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.scale.off('resize', this.onResize, this);
    });

    scene.input.on('pointerdown', this.onDown, this);
    scene.input.on('pointermove', this.onMove, this);
    scene.input.on('pointerup', this.onUp, this);
    scene.input.on('pointerupoutside', this.onUp, this);
  }

  private onDown(p: Phaser.Input.Pointer) {
    const { width } = this.scene.scale;
    if (p.x < width / 2) {
      // Begin movement tracking
      this.activePointer = p;
      this.originX = p.x;
      this.left = false;
      this.right = false;
      this.showOriginMarker(p.x, p.y);
    } else {
      // Start shooting; held until this pointer is released
      this.firePointers.add(p);
      this.fire = true;
      this.firePressed = true;
    }

    this.fadeHints();
  }

  private onMove(p: Phaser.Input.Pointer) {
    if (p === this.activePointer) {
      // Direction comes from the offset to the touch-down origin (joystick centre)
      const offset = p.x - this.originX;
      this.left = offset < -constants.touchDeadZone;
      this.right = offset > constants.touchDeadZone;

      if (this.originMarker && this.originHandle) {
        const dx = Phaser.Math.Clamp(p.x - this.originMarker.x, -36, 36);
        const dy = Phaser.Math.Clamp(p.y - this.originMarker.y, -36, 36);
        this.originHandle.setPosition(dx, dy);
      }
    }
  }

  private onUp(p: Phaser.Input.Pointer) {
    if (p === this.activePointer) {
      this.activePointer = null;
      this.left = this.right = false;
      this.hideOriginMarker();
    } else {
      this.firePointers.delete(p);
      this.fire = this.firePointers.size > 0;
    }
  }

  update(): void {
    // all state is event-driven
  }

  private showOriginMarker(x: number, y: number): void {
    if (!this.originMarker) {
      const outer = this.scene.add.circle(0, 0, 30, 0xffffff, 0.12).setStrokeStyle(2, 0xffffff, 0.5);
      const inner = this.scene.add.circle(0, 0, 6, 0xffffff, 0.8);
      const handle = this.scene.add.circle(0, 0, 10, 0xffffff, 0.7);
      this.originMarker = this.scene.add.container(x, y, [outer, inner, handle]).setDepth(15);
      this.originHandle = handle;
    } else {
      this.originMarker.setPosition(x, y);
      this.originHandle?.setPosition(0, 0);
    }
    this.originMarker.setVisible(true);
    this.originMarker.setAlpha(1);
  }

  private hideOriginMarker(): void {
    if (!this.originMarker) return;
    this.scene.tweens.add({
      targets: this.originMarker,
      alpha: 0,
      duration: 200,
      onComplete: () => this.originMarker?.setVisible(false),
    });
  }

  private onResize(size: Phaser.Structs.Size): void {
    this.layoutHints(size.width, size.height);
  }

  private layoutHints(width: number, height: number): void {
    this.divider.setPosition(width / 2, height / 2);
    this.divider.setSize(2, height);
    this.leftHint.setPosition(width * 0.25, height - 90);
    this.rightHint.setPosition(width * 0.75, height - 90);
    this.hintText.setPosition(width / 2, height - 50);
  }

  public fadeHints(): void {
    if (!this.hintShown) return;
    this.hintShown = false;
    this.scene.tweens.add({
      targets: [this.divider, this.leftHint, this.rightHint, this.hintText],
      alpha: 0,
      duration: 500,
      delay: 300,
    });
  }
}
