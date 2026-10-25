import Phaser from 'phaser';
import { constants } from '../constants';

export const size = 24;

// an icon in the top-right corner that toggles a setting when tapped or when its key is pressed;
// slot 0 is the rightmost, further slots line up to its left
export abstract class ToggleButton extends Phaser.GameObjects.Graphics {
  constructor(scene: Phaser.Scene, slot: number, key: string) {
    super(scene);
    scene.add.existing(this);
    // above the game-over overlay, so settings can be toggled there too
    this.setDepth(150);
    this.setInteractive(new Phaser.Geom.Rectangle(-4, -4, size + 8, size + 8), Phaser.Geom.Rectangle.Contains);
    this.on('pointerdown', () => this.onToggle());
    scene.input.keyboard.on(`keydown-${key}`, () => this.onToggle());

    const x = constants.width - constants.toggleButtonMargin - size - slot * (size + constants.toggleButtonGap);
    this.setPosition(x, constants.toggleButtonMargin);
    this.redraw();
  }

  protected abstract toggle(): void;

  // draws the icon in a size×size box at the origin
  protected abstract drawIcon(): void;

  private onToggle(): void {
    this.toggle();
    this.redraw();
  }

  private redraw(): void {
    this.clear();
    this.fillStyle(0xffffff, 0.8);
    this.lineStyle(2, 0xffffff, 0.8);
    this.drawIcon();
  }
}
