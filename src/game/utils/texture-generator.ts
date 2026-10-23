import Phaser from 'phaser';
import { constants } from '../constants';

export function generateAllTextures(scene: Phaser.Scene): void {
  const gfx = scene.add.graphics();

  // player
  gfx.fillStyle(constants.playerColor);
  gfx.fillTriangle(0, 32, 16, 0, 32, 32);
  gfx.generateTexture('player', 32, 32);
  gfx.clear();

  // enemy
  gfx.fillStyle(constants.enemyColor);
  gfx.fillTriangle(32, 0, 16, 32, 0, 0);
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

  // starfield
  const starGfx = scene.add.graphics();
  starGfx.fillStyle(constants.starColor);
  for (let i = 0; i < constants.starCount; i++) {
    starGfx.fillRect(
      Phaser.Math.Between(0, constants.starTileSize - 1),
      Phaser.Math.Between(0, constants.starTileSize - 1),
      1,
      1
    );
  }
  starGfx.generateTexture('star', constants.starTileSize, constants.starTileSize);
  starGfx.destroy();

  // explosion particle (white so it can be tinted)
  const particleGfx = scene.add.graphics();
  particleGfx.fillStyle(0xffffff);
  particleGfx.fillRect(0, 0, 4, 4);
  particleGfx.generateTexture('particle', 4, 4);
  particleGfx.destroy();
}

function drawPowerUpRing(gfx: Phaser.GameObjects.Graphics, color: number): void {
  gfx.lineStyle(2, color);
  gfx.strokeCircle(12, 12, 11);
  gfx.fillStyle(color);
}
