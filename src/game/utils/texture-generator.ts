import Phaser from 'phaser';
import { constants } from '../constants';
import { nebulaPixels } from './noise';

export function generateAllTextures(scene: Phaser.Scene): void {
  const gfx = scene.add.graphics();

  // 32x32 is a power of two, so WebGL wraps these textures (REPEAT) and a full-width edge
  // bleeds onto the opposite one as a faint line (which the ship glow amplifies);
  // keep that edge 1px inside the texture

  // player
  gfx.fillStyle(constants.playerColor);
  gfx.fillTriangle(0, 31, 16, 0, 32, 31);
  gfx.generateTexture('player', 32, 32);
  gfx.clear();

  // enemy
  gfx.fillStyle(constants.enemyColor);
  gfx.fillTriangle(32, 1, 16, 32, 0, 1);
  gfx.generateTexture('enemy', 32, 32);
  gfx.clear();

  // projectile
  gfx.fillStyle(constants.projectileColor);
  gfx.fillRect(0, 0, 4, 12);
  gfx.generateTexture('projectile', 4, 12);
  gfx.clear();

  // enemy projectile
  gfx.fillStyle(constants.enemyProjectileColor);
  gfx.fillRect(0, 0, 4, 12);
  gfx.generateTexture('enemy-projectile', 4, 12);
  gfx.clear();

  // power-up: shield
  drawPowerUpRing(gfx, constants.shieldColor);
  gfx.fillPoints(
    [
      { x: 7, y: 7 },
      { x: 17, y: 7 },
      { x: 17, y: 12 },
      { x: 12, y: 18 },
      { x: 7, y: 12 },
    ],
    true
  );
  gfx.generateTexture('powerup-shield', 24, 24);
  gfx.clear();

  // power-up: spread
  drawPowerUpRing(gfx, constants.spreadColor);
  gfx.lineBetween(12, 18, 12, 6);
  gfx.lineBetween(12, 18, 7, 8);
  gfx.lineBetween(12, 18, 17, 8);
  gfx.generateTexture('powerup-spread', 24, 24);
  gfx.clear();

  // power-up: bomb
  drawPowerUpRing(gfx, constants.bombColor);
  gfx.fillCircle(12, 13, 5);
  gfx.lineBetween(12, 8, 15, 5);
  gfx.generateTexture('powerup-bomb', 24, 24);
  gfx.destroy();

  // star layers, one tileable texture each
  const starGfx = scene.add.graphics();
  constants.starLayers.forEach((layer, i) => {
    for (let j = 0; j < layer.count; j++) {
      // vary brightness a little so the layer doesn't look flat
      starGfx.fillStyle(layer.color, Phaser.Math.FloatBetween(0.5, 1));
      starGfx.fillRect(
        Phaser.Math.Between(0, constants.starTileSize - layer.size),
        Phaser.Math.Between(0, constants.starTileSize - layer.size),
        layer.size,
        layer.size
      );
    }
    starGfx.generateTexture(`stars-${i}`, constants.starTileSize, constants.starTileSize);
    starGfx.clear();
  });
  starGfx.destroy();

  generateNebulaTexture(scene);

  // explosion particle (white so it can be tinted)
  const particleGfx = scene.add.graphics();
  particleGfx.fillStyle(0xffffff);
  particleGfx.fillRect(0, 0, 4, 4);
  particleGfx.generateTexture('particle', 4, 4);
  particleGfx.destroy();

  // enemy kinds
  const enemyGfx = scene.add.graphics();

  // tank: wide armoured hull
  enemyGfx.fillStyle(constants.tankColor);
  enemyGfx.fillPoints(
    [
      { x: 0, y: 0 },
      { x: 40, y: 0 },
      { x: 28, y: 36 },
      { x: 12, y: 36 },
    ],
    true
  );
  enemyGfx.fillStyle(0x000000, 0.35);
  enemyGfx.fillRect(6, 8, 28, 4);
  enemyGfx.fillRect(10, 18, 20, 4);
  enemyGfx.generateTexture('enemy-tank', 40, 36);
  enemyGfx.clear();

  // gunner: enemy shape with a targeting eye
  enemyGfx.fillStyle(constants.gunnerColor);
  enemyGfx.fillTriangle(32, 1, 16, 32, 0, 1);
  enemyGfx.fillStyle(0xffffff);
  enemyGfx.fillCircle(16, 9, 3);
  enemyGfx.generateTexture('enemy-gunner', 32, 32);
  enemyGfx.clear();

  // aimed enemy projectile: round, so it needs no rotation
  enemyGfx.fillStyle(constants.gunnerColor);
  enemyGfx.fillCircle(4, 4, 4);
  enemyGfx.generateTexture('enemy-projectile-aimed', 8, 8);
  enemyGfx.destroy();
}

function generateNebulaTexture(scene: Phaser.Scene): void {
  const size = constants.nebulaTextureSize;
  const texture = scene.textures.createCanvas('nebula', size, size);
  if (!texture) return;

  const pixels = nebulaPixels({
    size,
    basePeriod: constants.nebulaBasePeriod,
    octaves: constants.nebulaOctaves,
    coverage: constants.nebulaCoverage,
    maxAlpha: constants.nebulaMaxAlpha,
    colors: constants.nebulaColors,
  });
  const context = texture.getContext();
  const image = context.createImageData(size, size);
  image.data.set(pixels);
  context.putImageData(image, 0, 0);
  texture.refresh();
}

function drawPowerUpRing(gfx: Phaser.GameObjects.Graphics, color: number): void {
  gfx.lineStyle(2, color);
  gfx.strokeCircle(12, 12, 11);
  gfx.fillStyle(color);
}
