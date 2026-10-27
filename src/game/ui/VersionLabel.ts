import Phaser from 'phaser';
import { constants } from '../constants';
import { GAME_VERSION } from '../version';

// In playfield coordinates, so it stays visible when the window is resized.
export class VersionLabel extends Phaser.GameObjects.Text {
  constructor(scene: Phaser.Scene) {
    super(scene, constants.width / 2, constants.height - 16, `v${GAME_VERSION}`, {
      fontSize: '14px',
      color: '#888888',
    });
    this.setOrigin(0.5, 1);
    scene.add.existing(this);
  }
}
