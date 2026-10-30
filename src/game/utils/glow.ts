import Phaser from 'phaser';
import { constants } from '../constants';
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
  // the glow reaches glowDistance samples, scaled; a little extra so it fades out before the edge
  const padding = Math.ceil(scene.game.config.glowDistance * constants.shipGlowScale) + 4;
  for (const { key, color } of textures) {
    const sprite = scene.make.sprite({ key }, false);
    const hull = spriteSizes[key];
    sprite.setDisplaySize(hull.width, hull.height);
    if (addShipGlow(sprite, color)) {
      const width = hull.width + padding * 2;
      const height = hull.height + padding * 2;
      const texture = scene.textures.addDynamicTexture(glowTextureKey(key), width * textureResolution, height * textureResolution);
      if (texture) {
        texture.camera.setZoom(textureResolution).centerOn(width / 2, height / 2);
        texture.draw(sprite, width / 2, height / 2).render();
      }
    }
    sprite.destroy();
  }
}
