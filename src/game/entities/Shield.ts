import Phaser from 'phaser';
import { constants } from '../constants';

const textureKey = 'shield';
const glintTextureKey = 'shield-glint';

const rgba = (color: number, alpha: number) =>
  `rgba(${(color >> 16) & 0xff}, ${(color >> 8) & 0xff}, ${color & 0xff}, ${alpha})`;

// half-width and half-height of the shield's ellipse
const radii = {
  x: constants.shieldRadiusX,
  y: constants.shieldRadiusX * constants.shieldAspect,
};

// The player's shield: a glowing ellipse with glints orbiting its rim, broken by the first hit.
// The glow is baked into the texture, since a live glow filter costs an offscreen pass
// (see bakeGlowTextures)
export class Shield {
  private scene: Phaser.Scene;
  private container?: Phaser.GameObjects.Container;
  private glints: Phaser.GameObjects.Image[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  // drawn on a 2D canvas, which has the soft shadows and gradients that Graphics lacks
  static generateTextures(scene: Phaser.Scene): void {
    const padding = constants.shieldGlowBlur * 2;
    const width = Math.ceil(radii.x + padding) * 2;
    const height = Math.ceil(radii.y + padding) * 2;
    const texture = scene.textures.createCanvas(textureKey, width, height);
    if (texture) {
      drawShield(texture.getContext(), width / 2, height / 2);
      texture.refresh();
    }

    // a short streak of light, lying along the rim
    const glint = constants.shieldGlintSize;
    const glintTexture = scene.textures.createCanvas(glintTextureKey, glint.width, glint.height);
    if (!glintTexture) return;
    const context = glintTexture.getContext();
    context.translate(glint.width / 2, glint.height / 2);
    context.scale(1, glint.height / glint.width);
    const glow = context.createRadialGradient(0, 0, 0, 0, 0, glint.width / 2);
    glow.addColorStop(0, rgba(0xffffff, 1));
    glow.addColorStop(0.35, rgba(constants.shieldCoreColor, 0.8));
    glow.addColorStop(1, rgba(constants.shieldColor, 0));
    context.fillStyle = glow;
    context.fillRect(-glint.width / 2, -glint.width / 2, glint.width, glint.width);
    glintTexture.refresh();
  }

  activate(x: number, y: number): void {
    if (this.container) return;
    const rim = this.scene.add.image(0, 0, textureKey);
    this.glints = Array.from({ length: constants.shieldGlints }, () =>
      this.scene.add.image(0, 0, glintTextureKey)
    );
    for (const image of [rim, ...this.glints]) image.setBlendMode(Phaser.BlendModes.ADD);
    const container = this.scene.add.container(x, y, [rim, ...this.glints]);
    this.container = container;

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
  }

  // returns false if there was no shield to break
  shatter(): boolean {
    const container = this.container;
    if (!container) return false;
    this.container = undefined;
    this.glints = [];

    this.scene.tweens.killTweensOf(container);
    this.scene.tweens.add({
      targets: container,
      scale: 1.8,
      alpha: 0,
      duration: 250,
      onComplete: () => container.destroy(),
    });
    return true;
  }

  update(x: number, y: number): void {
    if (!this.container) return;
    this.container.setPosition(x, y);
    const spin = (this.scene.time.now / 1000) * constants.shieldGlintSpeed;
    this.glints.forEach((glint, i) => {
      const angle = spin + (i / this.glints.length) * Math.PI * 2;
      glint
        .setPosition(Math.cos(angle) * radii.x, Math.sin(angle) * radii.y)
        // along the tangent of the ellipse
        .setRotation(Math.atan2(radii.y * Math.cos(angle), -radii.x * Math.sin(angle)));
    });
  }
}

function drawShield(context: CanvasRenderingContext2D, cx: number, cy: number): void {
  // a faint bubble: clear in the middle, thickening towards the rim
  context.save();
  context.translate(cx, cy);
  context.scale(1, radii.y / radii.x);
  const fill = context.createRadialGradient(0, 0, 0, 0, 0, radii.x);
  fill.addColorStop(0, rgba(constants.shieldColor, 0));
  fill.addColorStop(0.6, rgba(constants.shieldColor, 0.03));
  fill.addColorStop(1, rgba(constants.shieldColor, 0.28));
  context.fillStyle = fill;
  context.beginPath();
  context.arc(0, 0, radii.x, 0, Math.PI * 2);
  context.fill();
  context.restore();

  // the rim: stroked twice with a soft shadow for the glow, then a bright core line on top
  context.beginPath();
  context.ellipse(cx, cy, radii.x, radii.y, 0, 0, Math.PI * 2);
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
