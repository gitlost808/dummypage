import Phaser from 'phaser';
import { constants } from '../constants';

// a bar across the top of the playfield, below the score, while the boss is on screen
export class BossHealthBar {
  private gfx: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.gfx = scene.add.graphics().setDepth(50);
  }

  // fraction in 0..1, or null to hide the bar
  public update(fraction: number | null): void {
    this.gfx.clear();
    if (fraction === null) return;
    const margin = 10;
    const width = constants.width - margin * 2;
    const { bossHealthBarY: y, bossHealthBarHeight: height } = constants;
    this.gfx
      .fillStyle(constants.bossColor, 0.25)
      .fillRect(margin, y, width, height)
      .fillStyle(constants.bossColor)
      .fillRect(margin, y, width * fraction, height);
  }
}
