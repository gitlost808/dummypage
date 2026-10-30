import Phaser from 'phaser';
import { constants } from '../constants';

// soft neon halo in the ship's color; filters are WebGL only, so this returns nothing under the
// canvas renderer and ships stay plain
export function addShipGlow(sprite: Phaser.GameObjects.Sprite, color: number): Phaser.Filters.Glow | undefined {
  if (!sprite.enableFilters().filters) return undefined;
  // pad automatically, so the halo isn't clipped at the texture edge
  const glow = sprite.filters.internal.addGlow(color, constants.shipGlowStrength, 0, constants.shipGlowScale);
  glow.setPaddingOverride(null);
  return glow;
}

// the texture with the baked glow, see bakeGlowTextures
export const glowTextureKey = (key: string) => `${key}-glow`;

// A live glow filter renders its ship on its own (offscreen pass, glow pass, composite), so nothing
// batches: phones dropped to ~35 fps with 50 glowing enemies. Enemies never change their glow, so
// render each of their textures with its glow once, into `<key>-glow`; those batch like any sprite
export function bakeGlowTextures(scene: Phaser.Scene, textures: { key: string; color: number }[]): void {
  // the glow reaches glowDistance samples, scaled; a little extra so it fades out before the edge
  const padding = Math.ceil(scene.game.config.glowDistance * constants.shipGlowScale) + 4;
  for (const { key, color } of textures) {
    const sprite = scene.make.sprite({ key }, false);
    if (addShipGlow(sprite, color)) {
      const width = sprite.width + padding * 2;
      const height = sprite.height + padding * 2;
      scene.textures.addDynamicTexture(glowTextureKey(key), width, height)?.draw(sprite, width / 2, height / 2).render();
    }
    sprite.destroy();
  }
}
