import Phaser from 'phaser';
import { constants } from '../constants';

type Layer = { container: Phaser.GameObjects.Container; glints: Phaser.GameObjects.Image[] };

const layerTextureKey = (layer: number) => `shield-${layer}`;
const glintTextureKey = 'shield-glint';

const rgba = (color: number, alpha: number) =>
  `rgba(${(color >> 16) & 0xff}, ${(color >> 8) & 0xff}, ${color & 0xff}, ${alpha})`;

// half-width and half-height of a layer's ellipse; each layer sits a gap outside the one beneath it
function layerRadii(layer: number): { x: number; y: number } {
  const x = constants.shieldRadiusX + layer * constants.shieldLayerGap;
  return { x, y: x * constants.shieldAspect };
}

// The player's shield: up to shieldMaxLayers glowing ellipses, innermost first, with glints
// orbiting each rim. A hit pops the outermost layer. The glow is baked into the textures,
// since a live glow filter per layer costs an offscreen pass each (see bakeGlowTextures)
export class Shield {
  private scene: Phaser.Scene;
  private layers: Layer[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  // drawn on a 2D canvas, which has the soft shadows and gradients that Graphics lacks
  static generateTextures(scene: Phaser.Scene): void {
    const padding = constants.shieldGlowBlur * 2;
    for (let i = 0; i < constants.shieldMaxLayers; i++) {
      const radii = layerRadii(i);
      const width = Math.ceil(radii.x + padding) * 2;
      const height = Math.ceil(radii.y + padding) * 2;
      const texture = scene.textures.createCanvas(layerTextureKey(i), width, height);
      if (!texture) continue;
      drawLayer(texture.getContext(), width / 2, height / 2, radii.x, radii.y);
      texture.refresh();
    }

    // a short streak of light, lying along the rim
    const { width, height } = constants.shieldGlintSize;
    const texture = scene.textures.createCanvas(glintTextureKey, width, height);
    if (!texture) return;
    const context = texture.getContext();
    context.translate(width / 2, height / 2);
    context.scale(1, height / width);
    const glow = context.createRadialGradient(0, 0, 0, 0, 0, width / 2);
    glow.addColorStop(0, rgba(0xffffff, 1));
    glow.addColorStop(0.35, rgba(constants.shieldCoreColor, 0.8));
    glow.addColorStop(1, rgba(constants.shieldColor, 0));
    context.fillStyle = glow;
    context.fillRect(-width / 2, -width / 2, width, width);
    texture.refresh();
  }

  get count(): number {
    return this.layers.length;
  }

  // returns false if the shield is already at full strength
  add(x: number, y: number): boolean {
    if (this.layers.length >= constants.shieldMaxLayers) return false;
    const rim = this.scene.add.image(0, 0, layerTextureKey(this.layers.length));
    const glints = Array.from({ length: constants.shieldGlints }, () =>
      this.scene.add.image(0, 0, glintTextureKey)
    );
    for (const image of [rim, ...glints]) image.setBlendMode(Phaser.BlendModes.ADD);
    const container = this.scene.add.container(x, y, [rim, ...glints]);
    this.layers.push({ container, glints });

    // snaps in from slightly larger, then breathes
    container.setScale(constants.shieldSpawnScale).setAlpha(0);
    this.scene.tweens.add({
      targets: container,
      scale: 1,
      alpha: 1,
      duration: constants.shieldSpawnMs,
      ease: 'Cubic.Out',
    });
    this.scene.tweens.add({
      targets: container,
      alpha: constants.shieldPulseAlpha,
      delay: constants.shieldSpawnMs,
      duration: constants.shieldPulseMs,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });
    return true;
  }

  // returns false if there was no layer to pop
  pop(): boolean {
    const layer = this.layers.pop();
    if (!layer) return false;

    const { container } = layer;
    this.scene.tweens.killTweensOf(container);
    this.scene.tweens.add({
      targets: container,
      scale: 1.8,
      alpha: 0,
      duration: 250,
      onComplete: () => container.destroy(),
    });
    // the layers left flinch
    for (const { container: inner } of this.layers) {
      this.scene.tweens.add({
        targets: inner,
        scale: constants.shieldFlinchScale,
        duration: 70,
        yoyo: true,
        onComplete: () => inner.setScale(1),
      });
    }
    return true;
  }

  update(x: number, y: number): void {
    const seconds = this.scene.time.now / 1000;
    this.layers.forEach(({ container, glints }, i) => {
      container.setPosition(x, y);
      const radii = layerRadii(i);
      // neighbouring layers spin opposite ways
      const spin = seconds * constants.shieldGlintSpeed * (i % 2 ? -1 : 1);
      glints.forEach((glint, j) => {
        const angle = spin + (j / glints.length) * Math.PI * 2;
        glint
          .setPosition(Math.cos(angle) * radii.x, Math.sin(angle) * radii.y)
          // along the tangent of the ellipse
          .setRotation(Math.atan2(radii.y * Math.cos(angle), -radii.x * Math.sin(angle)));
      });
    });
  }
}

function drawLayer(context: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number): void {
  // a faint bubble: clear in the middle, thickening towards the rim
  context.save();
  context.translate(cx, cy);
  context.scale(1, ry / rx);
  const fill = context.createRadialGradient(0, 0, 0, 0, 0, rx);
  fill.addColorStop(0, rgba(constants.shieldColor, 0));
  fill.addColorStop(0.6, rgba(constants.shieldColor, 0.03));
  fill.addColorStop(1, rgba(constants.shieldColor, 0.28));
  context.fillStyle = fill;
  context.beginPath();
  context.arc(0, 0, rx, 0, Math.PI * 2);
  context.fill();
  context.restore();

  // the rim: stroked twice with a soft shadow for the glow, then a bright core line on top
  context.beginPath();
  context.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  context.shadowColor = rgba(constants.shieldColor, 1);
  context.shadowBlur = constants.shieldGlowBlur;
  context.strokeStyle = rgba(constants.shieldColor, 0.9);
  context.lineWidth = 2.5;
  context.stroke();
  context.stroke();
  context.shadowBlur = 0;
  context.strokeStyle = rgba(constants.shieldCoreColor, 0.9);
  context.lineWidth = 1;
  context.stroke();
}
