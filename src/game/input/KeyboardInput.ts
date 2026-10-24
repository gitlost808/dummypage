import Phaser from 'phaser';
import { InputController } from "./InputController";

export class KeyboardInput implements InputController {
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  public left = false;
  public right = false;
  // keys never drag
  public readonly dragging = false;
  public dragX = 0;
  public fire = false;
  public firePressed = false;

  constructor(scene: Phaser.Scene) {
    this.cursors = scene.input.keyboard.createCursorKeys();
    scene.input.keyboard.on('keydown-SPACE', (event: KeyboardEvent) => {
      if (!event.repeat) this.firePressed = true;
    });
  }

  update(): void {
    this.left = this.cursors.left?.isDown ?? false;
    this.right = this.cursors.right?.isDown ?? false;
    this.fire = this.cursors.space?.isDown ?? false;
  }
}