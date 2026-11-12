import Phaser from 'phaser';
import { constants } from '../constants';
import { bankTextureKey } from './banking';
import { spriteSizes, SpriteTexture, textureResolution } from './texture-resolution';

// soft neon halo in the ship's color; filters are WebGL only, so this returns nothing under the
// canvas renderer and ships stay plain
export function addShipGlow(sprite: Phaser.GameObjects.Sprite, color: number): Phaser.Filters.Glow | undefined {
  if (!sprite.enableFilters().filters) return undefined;
  // pad automatically, so the halo isn't clipped at the texture edge
  // Internal filters work in source pixels, before the sprite is scaled down.
  const scale = constants.shipGlowScale / Math.abs(sprite.scaleX);
  const glow = sprite.filters.internal.addGlow(color, constants.shipGlowStrength, 0, scale);
  glow.setPaddingOverride(null);
  return glow;
}

// the texture with the baked glow, see bakeGlowTextures
export const glowTextureKey = (key: string) => `${key}-glow`;

// A live glow filter renders its ship on its own (offscreen pass, glow pass, composite), so nothing
// batches: phones dropped to ~35 fps with 50 glowing enemies. Enemies never change their glow, so
// render each of their textures with its glow once, into `<key>-glow`; those batch like any sprite
export function bakeGlowTextures(scene: Phaser.Scene, textures: { key: SpriteTexture; color: number }[]): void {
  for (const { key, color } of textures) {
    bakeGlow(scene, key, [undefined], glowTextureKey(key), color, spriteSizes[key]);
    // banking hulls get every bank frame baked too, one row of frames named like the hull's
    const bankKey = bankTextureKey(key);
    if (scene.textures.exists(bankKey)) {
      const frames = Array.from({ length: constants.shipBankFrames }, (_, i) => i);
      bakeGlow(scene, bankKey, frames, bankTextureKey(glowTextureKey(key)), color, spriteSizes[key]);
    }
  }
}

// renders the source's frames with their glow side by side into `target`, adding a frame for each
// when there is more than one. One row, so every frame spans the full height and doesn't depend on
// which way up the framebuffer stores it
function bakeGlow(
  scene: Phaser.Scene,
  source: string,
  frames: (number | undefined)[],
  target: string,
  color: number,
  hull: { width: number; height: number }
): void {
  // the glow reaches glowDistance samples, scaled; a little extra so it fades out before the edge
  const padding = Math.ceil(scene.game.config.glowDistance * constants.shipGlowScale) + 4;
  const width = hull.width + padding * 2;
  const height = hull.height + padding * 2;
  // DynamicTexture.draw only queues the sprite, so each frame needs a sprite of its own until render()
  const sprites = frames.map(frame => {
    const sprite = scene.make.sprite({ key: source, frame }, false);
    sprite.setDisplaySize(hull.width, hull.height);
    return { sprite, glow: addShipGlow(sprite, color) };
  });
  if (sprites.every(({ glow }) => glow)) {
    const texture = scene.textures.addDynamicTexture(target, width * frames.length * textureResolution, height * textureResolution);
    if (texture) {
      texture.camera.setZoom(textureResolution).centerOn((width * frames.length) / 2, height / 2);
      sprites.forEach(({ sprite }, i) => texture.draw(sprite, width * (i + 0.5), height / 2));
      texture.render();
      if (frames.length > 1) {
        frames.forEach((_, i) => texture.add(i, 0, i * width * textureResolution, 0, width * textureResolution, height * textureResolution));
      }
    }
  }
  for (const { sprite } of sprites) sprite.destroy();
}
