import Phaser from 'phaser';
import { Starfield } from './entities/Starfield';

// the starfield, unzoomed and filling the whole window behind the fixed-size playfield;
// runs for the whole session, so it keeps scrolling through game over and restarts
export default class BackgroundScene extends Phaser.Scene {
  private starfield!: Starfield;

  constructor() {
    super('BackgroundScene');
  }

  create(): void {
    this.starfield = new Starfield(this);
    this.fitCamera();
    // this scene is never stopped, so the listener needs no cleanup
    this.scale.on('resize', () => this.fitCamera());
  }

  private fitCamera(): void {
    // Background speeds and star sizes stay in CSS pixels on dense displays.
    const density = 1 / this.scale.zoom;
    const { width, height } = this.scale;
    this.cameras.main.setViewport(0, 0, width, height).setZoom(density).centerOn(width / density / 2, height / density / 2);
    this.starfield.setSize(width / density, height / density);
  }

  update(): void {
    this.starfield.update();
  }
}
