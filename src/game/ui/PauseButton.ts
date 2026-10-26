import Phaser from 'phaser';
import { ToggleButton } from './ToggleButton';

// two bars left of the music button while playing, a play triangle on the pause screen;
// tap it or press P or Esc to pause or resume
export class PauseButton extends ToggleButton {
  private action: () => void;

  constructor(scene: Phaser.Scene, action: () => void) {
    super(scene, 2, 'P', 'ESC');
    this.action = action;
  }

  protected toggle(): void {
    this.action();
  }

  protected drawIcon(): void {
    if (this.scene.scene.isPaused('GameScene')) {
      this.fillTriangle(6, 3, 6, 21, 21, 12);
    } else {
      this.fillRect(5, 3, 5, 18);
      this.fillRect(14, 3, 5, 18);
    }
  }
}
