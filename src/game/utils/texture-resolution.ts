import type Phaser from 'phaser';

// Small procedural sprites need enough samples for the camera's 2.25x zoom at
// 4K. Bake at 4x so resizing onto a larger display doesn't require replacing
// textures already held by sprites, particles, and physics bodies.
export const textureResolution = 4;

// Gameplay sizes are independent of the number of pixels in each texture.
// Sprites use these with setDisplaySize; texture frames keep their native sizes.
export const spriteSizes = {
  player: { width: 32, height: 32 },
  enemy: { width: 32, height: 32 },
  'enemy-tank': { width: 40, height: 36 },
  'enemy-gunner': { width: 32, height: 32 },
  boss: { width: 112, height: 72 },
  projectile: { width: 4, height: 12 },
  'enemy-projectile': { width: 4, height: 12 },
  'enemy-projectile-aimed': { width: 8, height: 8 },
  'boss-projectile': { width: 10, height: 10 },
  'powerup-shield': { width: 24, height: 24 },
  'powerup-spread': { width: 24, height: 24 },
  'powerup-laser': { width: 24, height: 24 },
  'powerup-bomb': { width: 24, height: 24 },
} as const;

export type SpriteTexture = keyof typeof spriteSizes;

export function generateGraphicsTexture(graphics: Phaser.GameObjects.Graphics, key: SpriteTexture): void {
  const { width, height } = spriteSizes[key];
  graphics.setScale(textureResolution);
  graphics.generateTexture(key, width * textureResolution, height * textureResolution);
  graphics.setScale(1);
}
