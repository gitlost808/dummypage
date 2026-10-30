import Phaser from 'phaser';
import { constants } from '../constants';
import { nebulaPixels } from './noise';

// the boss hull's underside from left to right, and the cannons hanging below it, in texture pixels;
// the boss blocks the laser there (see Boss.undersideAt)
export const bossUnderside: [number, number][] = [[1, 26], [32, 40], [46, 71], [66, 71], [80, 40], [111, 26]];
export const bossCannons = [
  { left: 18, right: 24, bottom: 48 },
  { left: 88, right: 94, bottom: 48 },
];

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
      new Phaser.Math.Vector2(7, 7),
      new Phaser.Math.Vector2(17, 7),
      new Phaser.Math.Vector2(17, 12),
      new Phaser.Math.Vector2(12, 18),
      new Phaser.Math.Vector2(7, 12),
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

  // power-up: laser, a ship firing one beam
  drawPowerUpRing(gfx, constants.laserColor);
  gfx.fillRect(11, 4, 2, 10);
  gfx.fillTriangle(7, 19, 12, 13, 17, 19);
  gfx.generateTexture('powerup-laser', 24, 24);
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
  generateLaserTexture(scene);

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
      new Phaser.Math.Vector2(0, 0),
      new Phaser.Math.Vector2(40, 0),
      new Phaser.Math.Vector2(28, 36),
      new Phaser.Math.Vector2(12, 36),
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
  enemyGfx.clear();

  // boss: a broad hull with swept wings, two cannons and a glowing core
  enemyGfx.fillStyle(constants.bossColor);
  // the top edge, then back along the underside
  const bossOutline = [[10, 1], [102, 1], ...[...bossUnderside].reverse()];
  enemyGfx.fillPoints(
    bossOutline.map(([x, y]) => new Phaser.Math.Vector2(x, y)),
    true
  );
  for (const { left, right, bottom } of bossCannons) enemyGfx.fillRect(left, 26, right - left, bottom - 26);
  enemyGfx.fillStyle(0x000000, 0.35);
  enemyGfx.fillRect(14, 8, 84, 4);
  enemyGfx.fillRect(30, 18, 52, 4);
  enemyGfx.fillStyle(0xffffff);
  enemyGfx.fillCircle(56, 40, 7);
  enemyGfx.generateTexture('boss', 112, 72);
  enemyGfx.clear();

  // boss projectile: round with a bright centre, so it stands out from the gunner's
  enemyGfx.fillStyle(constants.bossProjectileColor);
  enemyGfx.fillCircle(5, 5, 5);
  enemyGfx.fillStyle(0xffffff);
  enemyGfx.fillCircle(5, 5, 2);
  enemyGfx.generateTexture('boss-projectile', 10, 10);
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

// a slice across the laser beam, stretched to its length: a white-hot core fading out into a soft glow
function generateLaserTexture(scene: Phaser.Scene): void {
  const width = 32;
  const height = 4;
  const texture = scene.textures.createCanvas('laser-beam', width, height);
  if (!texture) return;

  const glow = Phaser.Display.Color.IntegerToColor(constants.laserColor);
  const core = Phaser.Display.Color.IntegerToColor(constants.laserCoreColor);
  const context = texture.getContext();
  const image = context.createImageData(width, height);
  for (let x = 0; x < width; x++) {
    // 0 at the centre, 1 at the edges, where the glow has faded out
    const d = Math.abs(x + 0.5 - width / 2) / (width / 2);
    const coreAmount = Math.exp(-((d / 0.15) ** 2));
    const glowAmount = Math.exp(-((d / 0.45) ** 2));
    const mix = (from: number, to: number) => Math.round(from + (to - from) * coreAmount);
    const pixel = [mix(glow.red, core.red), mix(glow.green, core.green), mix(glow.blue, core.blue)];
    const alpha = Math.round(255 * Math.max(coreAmount, glowAmount * 0.7));
    for (let y = 0; y < height; y++) image.data.set([...pixel, alpha], (y * width + x) * 4);
  }
  context.putImageData(image, 0, 0);
  texture.refresh();
}

function drawPowerUpRing(gfx: Phaser.GameObjects.Graphics, color: number): void {
  gfx.lineStyle(2, color);
  gfx.strokeCircle(12, 12, 11);
  gfx.fillStyle(color);
}
