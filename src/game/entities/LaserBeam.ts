import Phaser from 'phaser';
import { constants } from '../constants';
import { loopSound, playSound } from '../utils/audio';

// the laser power-up's weapon: a beam from the ship's nose straight up, on while fire is held.
// It only draws and sounds; GameScene decides what it hits (see overlaps)
export class LaserBeam {
  private scene: Phaser.Scene;
  private beam: Phaser.GameObjects.Image;
  // the muzzle flare, the pulses running up the beam and the flare where something blocks it
  private flares: Phaser.GameObjects.Graphics;
  private hum?: Phaser.Sound.BaseSound;
  private onUntil = 0;
  // the column the beam covers this frame
  private x = 0;
  private top = 0;
  private bottom = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    // additive, so the glow brightens whatever it passes over
    this.beam = scene.add
      .image(0, 0, 'laser-beam')
      .setOrigin(0.5, 1)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setVisible(false);
    this.flares = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    this.hum = loopSound(scene, 'laser-hum');
    // the sound manager outlives the scene, so a restart mid-beam would leave the hum running
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.hum?.stop());
  }

  get isOn(): boolean {
    return this.scene.time.now < this.onUntil;
  }

  // fire is held (or tapped): keep the beam on a little longer, igniting it if it was off
  fire(): void {
    if (!this.isOn) {
      playSound(this.scene, 'laser');
      this.hum?.play();
    }
    this.onUntil = this.scene.time.now + constants.laserLingerMs;
  }

  // switch off right away: the power-up ran out or the game ended
  stop(): void {
    this.onUntil = 0;
    this.hide();
  }

  // follow the ship: the beam runs from its nose (bottom) up to top; blocked marks where it ends on the boss
  update(x: number, bottom: number, top: number, blocked: boolean): void {
    this.flares.clear();
    if (!this.isOn) return this.hide();
    this.x = x;
    this.top = top;
    this.bottom = bottom;

    const now = this.scene.time.now;
    // a slow throb plus a little jitter
    const flicker =
      1 + constants.laserFlicker * (0.6 * Math.sin(now * 0.05) + 0.4 * Phaser.Math.FloatBetween(-1, 1));
    const width = constants.laserWidth * flicker;
    const length = Math.max(0, bottom - top);
    this.beam.setVisible(true).setPosition(x, bottom).setDisplaySize(width, length);

    // pulses of light running up the beam, evenly spaced over the screen's height
    const spacing = constants.height / constants.laserPulses;
    this.flares.fillStyle(constants.laserCoreColor, 0.8);
    for (let d = ((now * constants.laserPulseSpeed) / 1000) % spacing; d < length; d += spacing) {
      this.flares.fillEllipse(x, bottom - d, width * 0.4, 28);
    }

    this.drawFlare(x, bottom, width * 0.6);
    if (blocked) this.drawFlare(x, top, width * 0.8 * flicker);
  }

  // whether the beam touches a body this frame
  overlaps(body: Phaser.Physics.Arcade.Body): boolean {
    const half = constants.laserHitWidth / 2;
    return (
      this.isOn &&
      body.right > this.x - half &&
      body.left < this.x + half &&
      body.bottom > this.top &&
      body.top < this.bottom
    );
  }

  private drawFlare(x: number, y: number, radius: number): void {
    this.flares.fillStyle(constants.laserColor, 0.5).fillCircle(x, y, radius);
    this.flares.fillStyle(constants.laserCoreColor, 0.9).fillCircle(x, y, radius * 0.45);
  }

  private hide(): void {
    this.beam.setVisible(false);
    this.flares.clear();
    if (this.hum?.isPlaying) this.hum.stop();
  }
}
