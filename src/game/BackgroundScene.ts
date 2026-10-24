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
    // this scene is never stopped, so the listener needs no cleanup
    this.scale.on('resize', (size: Phaser.Structs.Size) => this.starfield.setSize(size.width, size.height));
  }

  update(): void {
    this.starfield.update();
  }
}
