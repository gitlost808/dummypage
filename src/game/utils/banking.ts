import Phaser from 'phaser';
import { constants } from '../constants';

// Ships roll into sideways movement. Seen from above, a roll narrows the hull, slides its raised
// centre ridge towards the turn, and darkens the side dipping away. Each banked texture holds
// constants.shipBankFrames frames in one row, named 0 (fully left) to shipBankFrames - 1 (fully right)

export const bankTextureKey = (key: string) => `${key}-bank`;

export const levelBankFrame = (constants.shipBankFrames - 1) / 2;

// the frame for a bank between -1 (fully left) and 1 (fully right)
export function bankFrame(bank: number): number {
  return Math.round(levelBankFrame * (1 + Phaser.Math.Clamp(bank, -1, 1)));
}

// the roll drawn in a frame, in radians; positive dips the right wing
export function frameRoll(frame: number): number {
  return ((frame - levelBankFrame) / levelBankFrame) * constants.shipBankMaxAngle;
}

// ease a bank towards the target at any frame rate
export function easeBank(bank: number, target: number, dt: number): number {
  return bank + (Phaser.Math.Clamp(target, -1, 1) - bank) * (1 - Math.exp(-constants.shipBankRate * dt));
}

// the hull as flat facets, each a polygon of [x, y, z] points with z pointing up out of the screen,
// plus round details (cockpits, eyes) sitting on it
type Point3 = [number, number, number];
export type BankedHull = {
  color: number;
  facets: Point3[][];
  spots?: { at: Point3; radius: number; color: number }[];
};

// a triangle with a ridge along its centre line, rising from the tip to the wide end
function ridgedTriangle(color: number, tipY: number, baseY: number, width: number): BankedHull {
  const cx = width / 2;
  const h = constants.shipRidgeHeight;
  return {
    color,
    facets: [
      [[cx, tipY, 0], [0, baseY, 0], [cx, baseY, h]],
      [[cx, tipY, 0], [cx, baseY, h], [width, baseY, 0]],
    ],
  };
}

// the ridge's height at y, for details that sit on it
const ridgeZ = (y: number, tipY: number, baseY: number) => (constants.shipRidgeHeight * (y - tipY)) / (baseY - tipY);

export const bankedHulls = {
  // same outlines as the flat textures (see generateAllTextures)
  player: ridgedTriangle(constants.playerColor, 0, 31, 32),
  enemy: ridgedTriangle(constants.enemyColor, 32, 1, 32),
  'enemy-gunner': {
    ...ridgedTriangle(constants.gunnerColor, 32, 1, 32),
    spots: [{ at: [16, 9, ridgeZ(9, 32, 1)], radius: 3, color: 0xffffff }],
  },
} satisfies Record<string, BankedHull>;

// draws the hull rolled about its vertical centre line, with its top-left corner at (ox, oy)
export function drawBankedHull(gfx: Phaser.GameObjects.Graphics, hull: BankedHull, width: number, roll: number, ox: number, oy: number): void {
  const cx = width / 2;
  const cos = Math.cos(roll);
  const sin = Math.sin(roll);
  const rotate = ([x, y, z]: Point3): Point3 => [cx + (x - cx) * cos + z * sin, y, z * cos - (x - cx) * sin];

  for (const facet of hull.facets) {
    // light from the viewer: relative to the level hull, so a level hull keeps its flat color
    const shade = facingViewer(facet.map(rotate)) / facingViewer(facet);
    gfx.fillStyle(shadeColor(hull.color, shade));
    gfx.fillPoints(facet.map(p => rotate(p)).map(([x, y]) => new Phaser.Math.Vector2(ox + x, oy + y)), true);
  }
  for (const { at, radius, color } of hull.spots ?? []) {
    const [x, y] = rotate(at);
    gfx.fillStyle(color);
    // seen at an angle, a round spot narrows
    gfx.fillEllipse(ox + x, oy + y, radius * 2 * cos, radius * 2);
  }
}

// how directly a facet faces the viewer: 1 when flat, less as it tilts away
function facingViewer([a, b, c]: Point3[]): number {
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  return Math.abs(n[2]) / Math.hypot(n[0], n[1], n[2]);
}

// darken below 1, brighten towards white above it
function shadeColor(color: number, shade: number): number {
  const c = Phaser.Display.Color.IntegerToColor(color);
  const channel = (v: number) =>
    Math.round(shade <= 1 ? v * shade : v + (255 - v) * Math.min(shade - 1, 1));
  return Phaser.Display.Color.GetColor(channel(c.red), channel(c.green), channel(c.blue));
}
