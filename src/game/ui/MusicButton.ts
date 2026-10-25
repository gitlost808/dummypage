import Phaser from 'phaser';
import { isMusicOn, toggleMusic } from '../utils/audio';
import { ToggleButton } from './ToggleButton';

// two beamed notes left of the speaker; tap them or press N to toggle just the music
export class MusicButton extends ToggleButton {
  constructor(scene: Phaser.Scene) {
    super(scene, 1, 'N');
  }

  protected toggle(): void {
    toggleMusic(this.scene);
  }

  protected drawIcon(): void {
    const on = isMusicOn();
    // dimmed and struck through when off
    if (!on) this.fillStyle(0xffffff, 0.35);

    this.fillEllipse(6, 19, 8, 6);
    this.fillEllipse(18, 16, 8, 6);
    // stems, and the beam joining them
    this.fillRect(8, 5, 2, 14);
    this.fillRect(20, 2, 2, 14);
    this.fillPoints([{ x: 8, y: 5 }, { x: 22, y: 2 }, { x: 22, y: 6 }, { x: 8, y: 9 }], true);

    if (!on) this.lineBetween(2, 22, 22, 2);
  }
}
