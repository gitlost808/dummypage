import Phaser from 'phaser';
import { constants } from '../constants';

export class EffectsSystem {
  private scene: Phaser.Scene;
  private emitter: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.emitter = scene.add
      .particles(0, 0, 'particle', {
        emitting: false,
        speed: { min: constants.explosionSpeedMin, max: constants.explosionSpeedMax },
        lifespan: { min: constants.explosionLifespanMin, max: constants.explosionLifespanMax },
        scale: { start: 1, end: 0 },
        alpha: { start: 1, end: 0 },
      })
      .setDepth(10);
  }

  explode(x: number, y: number, color = 0xffffff, count = constants.explosionParticles): void {
    // tint applies to the particles emitted from now on, so earlier bursts keep their color
    this.emitter.setParticleTint(color);
    this.emitter.explode(count, x, y);
  }

  shake(durationMs: number, intensity: number): void {
    this.scene.cameras.main.shake(durationMs, intensity);
  }
}
