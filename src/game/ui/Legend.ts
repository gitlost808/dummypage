import Phaser from 'phaser';
import { constants } from '../constants';
import { LegendEntry } from '../entities/LegendEntry';
import { powerUpKinds } from '../entities/PowerUp';
import { enemyKinds } from '../entities/EnemyShip';
import { Boss } from '../entities/Boss';
import { glowTextureKey } from '../utils/glow';
import { textureResolution } from '../utils/texture-resolution';

const toHex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

// built from the kind registries, so a new power-up or enemy kind shows up here on its own;
// only a new class with its own legend (like the boss) needs adding by hand
const sections: { heading: string; entries: LegendEntry[] }[] = [
  { heading: 'POWER-UPS', entries: Object.values(powerUpKinds) },
  { heading: 'ENEMIES', entries: [...Object.values(enemyKinds), Boss.legend] },
];

const margin = 40;
// icons are scaled down to fit this box
const iconWidth = 48;
const iconHeight = 40;
const textX = margin + iconWidth + 16;
const headingGap = 12;
const rowGap = 14;
const sectionGap = 24;

// the title screen's list of power-ups and enemies: an icon, a name and a line on what it does,
// flowing down from y; its size is the space it takes up
export class Legend extends Phaser.GameObjects.Container {
  constructor(scene: Phaser.Scene, y: number) {
    super(scene, 0, y);
    scene.add.existing(this);

    let rowY = 0;
    sections.forEach(({ heading, entries }, i) => {
      if (i > 0) rowY += sectionGap;
      const title = scene.add.text(margin, rowY, heading, { fontSize: '16px', color: '#888888' });
      this.add(title);
      rowY += title.height + headingGap;
      for (const entry of entries) rowY += this.addRow(entry, rowY) + rowGap;
    });
    this.setSize(constants.width, rowY - rowGap);
  }

  // returns the row's height
  private addRow(entry: LegendEntry, y: number): number {
    const scene = this.scene;
    const name = scene.add.text(textX, y, entry.name, { fontSize: '18px', color: toHex(entry.color) });
    const description = scene.add.text(textX, y + name.height + 2, entry.description, {
      fontSize: '14px',
      color: '#cccccc',
      wordWrap: { width: constants.width - textX - margin },
    });
    const height = Math.max(iconHeight, name.height + 2 + description.height);

    // sized by the hull, so a baked glow spills around it as it does in the game
    const hull = scene.textures.getFrame(entry.texture);
    const glow = glowTextureKey(entry.texture);
    const icon = scene.add
      .image(margin + iconWidth / 2, y + height / 2, scene.textures.exists(glow) ? glow : entry.texture)
      .setScale(Math.min(1 / textureResolution, iconWidth / hull.width, iconHeight / hull.height));

    this.add([icon, name, description]);
    return height;
  }
}
