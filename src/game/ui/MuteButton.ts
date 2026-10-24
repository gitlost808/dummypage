import Phaser from 'phaser';
import { constants } from '../constants';
import { saveMuted } from '../utils/audio';

const size = 24;

// speaker icon in the top-right corner; tap it or press M to toggle sound
export class MuteButton extends Phaser.GameObjects.Graphics {
  constructor(scene: Phaser.Scene) {
    super(scene);
    scene.add.existing(this);
    // above the game-over overlay, so sound can be toggled there too
    this.setDepth(150);
    this.setInteractive(new Phaser.Geom.Rectangle(-4, -4, size + 8, size + 8), Phaser.Geom.Rectangle.Contains);
    this.on('pointerdown', () => this.toggle());
    scene.input.keyboard.on('keydown-M', () => this.toggle());

    this.setPosition(constants.width - size - constants.muteButtonMargin, constants.muteButtonMargin);
    this.draw();
  }

  private toggle(): void {
    // the sound manager is shared by all scenes, so this survives restarts
    const sound = this.scene.sound;
    sound.mute = !sound.mute;
    saveMuted(sound.mute);
    this.draw();
  }

  private draw(): void {
    this.clear();
    this.fillStyle(0xffffff, 0.8);
    this.lineStyle(2, 0xffffff, 0.8);

    // speaker
    this.fillRect(2, 8, 5, 8);
    this.fillTriangle(5, 12, 13, 3, 13, 21);

    if (this.scene.sound.mute) {
      this.lineBetween(16, 8, 23, 16);
      this.lineBetween(23, 8, 16, 16);
    } else {
      this.beginPath();
      this.arc(13, 12, 5, -Math.PI / 4, Math.PI / 4);
      this.strokePath();
      this.beginPath();
      this.arc(13, 12, 9, -Math.PI / 4, Math.PI / 4);
      this.strokePath();
    }
  }
}
