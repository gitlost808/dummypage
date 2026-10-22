import Phaser from 'phaser';
import { EnemyShip } from '../entities/EnemyShip';
import { PlayerShip } from '../entities/PlayerShip';
import { ScoreSystem } from './ScoreSystem';
import { constants } from '../constants';

export class EnemySpawner {
  private scene: Phaser.Scene;
  private player: PlayerShip;
  private scoreSystem: ScoreSystem;
  private enemies: Phaser.Physics.Arcade.Group;
  private startTime: number;
  private enemyProjectiles: Phaser.Physics.Arcade.Group;

  constructor(
    scene: Phaser.Scene,
    player: PlayerShip,
    scoreSystem: ScoreSystem,
    enemyProjectiles: Phaser.Physics.Arcade.Group
  ) {
    this.scene = scene;
    this.player = player;
    this.scoreSystem = scoreSystem;
    this.enemyProjectiles = enemyProjectiles;
    this.enemies = scene.physics.add.group({
      classType: EnemyShip,
      maxSize: constants.maxEnemies,
      runChildUpdate: true,
    });
    this.startTime = scene.time.now;
    this.scheduleNext();
  }

  private scheduleNext(): void {
    const tier = this.getTier();
    const interval = Phaser.Math.Clamp(
      constants.baseInterval - tier * constants.intervalDecrement,
      constants.minInterval,
      constants.baseInterval
    );
    this.scene.time.addEvent({
      delay: interval,
      callback: () => {
        this.spawn();
        this.scheduleNext();
      },
      callbackScope: this,
    });
  }

  private spawn(): void {
    const x = Phaser.Math.Between(
      constants.enemySpawnMinX,
      constants.enemySpawnMaxX
    );
    const tier = this.getTier();
    const behavior = this.pickBehavior(tier);

    const speed = constants.enemyBaseSpeed + tier * constants.enemySpeedIncrement;
    const trackStrength = Phaser.Math.Clamp(
      constants.enemyTrackStrengthBase + tier * constants.enemyTrackStrengthIncrement,
      0.6,
      1.25,
    );
    const swayAmplitude = constants.enemySwayAmplitudeBase + tier * constants.enemySwayAmplitudeIncrement;
    const swayFrequency = constants.enemySwayFrequencyBase + tier * constants.enemySwayFrequencyIncrement;
    const evasionScale = 1 + tier * 0.15;
    const diveChancePerSecond = Math.max(
      0,
      constants.enemyDiveChanceBase + (tier - 1) * constants.enemyDiveChanceIncrement
    );
    const fireIntervalMs = tier < constants.enemyFireStartTier
      ? 0
      : Phaser.Math.Clamp(
          constants.enemyFireIntervalBase - tier * constants.enemyFireIntervalDecrement,
          constants.enemyFireIntervalMin,
          constants.enemyFireIntervalBase
        );

    // Obtain an enemy from the pool (or create if none free)
    const enemy = this.enemies.get(x, 0, 'enemy') as EnemyShip;
    if (!enemy) {
      return;
    }

    // Reactivate (resetting the body to the spawn point) and configure
    enemy.enableBody(true, x, 0, true, true);
    enemy.setTarget(this.player);
    enemy.configure({
      behavior,
      speed,
      swayAmplitude,
      swayFrequency,
      trackStrength,
      evasionScale,
      diveChancePerSecond,
      fireIntervalMs,
    }, this.enemyProjectiles);
  }

  public getGroup(): Phaser.Physics.Arcade.Group {
    return this.enemies;
  }

  private getTier(): number {
    const scoreTier = Math.floor(this.scoreSystem.getScore() / constants.scorePerTier);
    const elapsed = this.scene.time.now - this.startTime;
    const timeTier = Math.floor(elapsed / constants.difficultyTimeStepMs);
    return Phaser.Math.Clamp(
      Math.max(scoreTier, timeTier),
      0,
      constants.maxDifficultyTier
    );
  }

  private pickBehavior(tier: number): 'basic' | 'strafer' | 'diver' {
    const weights = [
      { basic: 1, strafer: 0, diver: 0 },
      { basic: 1, strafer: 1, diver: 0 },
      { basic: 0.8, strafer: 1, diver: 0.3 },
      { basic: 0.6, strafer: 1, diver: 0.6 },
      { basic: 0.4, strafer: 1, diver: 0.9 },
      { basic: 0.25, strafer: 0.9, diver: 1 },
      { basic: 0.15, strafer: 0.8, diver: 1 },
    ];

    const index = Phaser.Math.Clamp(tier, 0, weights.length - 1);
    const tierWeights = weights[index];
    const total = tierWeights.basic + tierWeights.strafer + tierWeights.diver;
    const roll = Math.random() * total;

    if (roll < tierWeights.basic) return 'basic';
    if (roll < tierWeights.basic + tierWeights.strafer) return 'strafer';
    return 'diver';
  }
}
