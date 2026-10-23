import Phaser from 'phaser';
import { constants } from '../constants';

type Layer = {
  sprite: Phaser.GameObjects.TileSprite;
  // pixels/sec
  speed: number;
};

// scrolling background: the nebula, with parallax star layers on top
export class Starfield {
  private scene: Phaser.Scene;
  private layers: Layer[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.addLayer('nebula', constants.nebulaScrollSpeed, constants.nebulaTileScale);
    constants.starLayers.forEach((layer, i) => this.addLayer(`stars-${i}`, layer.speed));
  }

  private addLayer(texture: string, speed: number, tileScale = 1): void {
    const { width, height } = this.scene.scale;
    const sprite = this.scene.add
      .tileSprite(0, 0, width, height, texture)
      .setOrigin(0)
      .setScrollFactor(0)
      .setTileScale(tileScale);
    this.layers.push({ sprite, speed });
  }

  update(): void {
    const seconds = this.scene.game.loop.delta / 1000;
    for (const { sprite, speed } of this.layers) {
      sprite.tilePositionY -= speed * seconds;
    }
  }

  setSize(width: number, height: number): void {
    for (const { sprite } of this.layers) sprite.setSize(width, height);
  }
}
