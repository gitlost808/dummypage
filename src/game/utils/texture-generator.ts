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
  enemyGfx.fillTriangle(32, 0, 16, 32, 0, 0);
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

function drawPowerUpRing(gfx: Phaser.GameObjects.Graphics, color: number): void {
  gfx.lineStyle(2, color);
  gfx.strokeCircle(12, 12, 11);
  gfx.fillStyle(color);
}
