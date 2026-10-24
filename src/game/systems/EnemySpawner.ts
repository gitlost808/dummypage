import Phaser from 'phaser';
import { EnemyShip, EnemyKind, EnemyBehavior } from '../entities/EnemyShip';
import { PlayerShip } from '../entities/PlayerShip';
import { Boss } from '../entities/Boss';
import { constants } from '../constants';

type Range = [number, number];
type Unlockable = { unlockAt: number; weight: Range };

// interpolate an [easy, hard] range by difficulty
function scale([easy, hard]: Range, difficulty: number): number {
  return easy + (hard - easy) * difficulty;
}

// weighted random pick among the entries unlocked at this difficulty; each weight
// ramps from its first value at unlock to its second at difficulty 1
function pickWeighted<K extends string>(table: Record<K, Unlockable>, difficulty: number): K {
  const entries = (Object.entries(table) as [K, Unlockable][])
    .filter(([, { unlockAt }]) => difficulty >= unlockAt)
    .map(([key, { unlockAt, weight }]) => {
      const progress = unlockAt < 1 ? (difficulty - unlockAt) / (1 - unlockAt) : 1;
      return [key, scale(weight, progress)] as const;
    });
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = Math.random() * total;
  for (const [key, weight] of entries) {
    roll -= weight;
    if (roll < 0) return key;
  }
  return entries[entries.length - 1][0];
}

export class EnemySpawner {
  private scene: Phaser.Scene;
  private player: PlayerShip;
  private enemies: Phaser.Physics.Arcade.Group;
  private startTime: number;
  private enemyProjectiles: Phaser.Physics.Arcade.Group;

  // threat saved up towards the next spawn
  private threatBank = 0;
  // picked in advance, so pricier enemies aren't crowded out by cheap ones
  private nextKind: EnemyKind = 'normal';
  private nextSpawnAt = 0;

  private wave = 0;
  private waveEndsAt = 0;
  private onWaveStart: (wave: number, isBoss: boolean) => void;

  // boss waves last until the boss is beaten, and the difficulty clock stands still meanwhile
  private boss: Boss;
  private isBossWave = false;
  private bossWaveStartedAt = 0;
  private pausedMs = 0;

  constructor(
    scene: Phaser.Scene,
    player: PlayerShip,
    enemyProjectiles: Phaser.Physics.Arcade.Group,
    boss: Boss,
    onWaveStart: (wave: number, isBoss: boolean) => void
  ) {
    this.scene = scene;
    this.player = player;
    this.enemyProjectiles = enemyProjectiles;
    this.boss = boss;
    this.onWaveStart = onWaveStart;
    this.enemies = scene.physics.add.group({
      classType: EnemyShip,
      maxSize: constants.maxEnemies,
      runChildUpdate: true,
    });
    this.startTime = scene.time.now;
    this.startWave();
    scene.time.addEvent({
      delay: constants.spawnTickMs,
      loop: true,
      callback: this.tick,
      callbackScope: this,
    });
  }

  // 0..1 from time survived only, so score (and bomb bonuses) can't jump it
  public getDifficulty(): number {
    return 1 - Math.exp(-this.elapsed() / constants.difficultyRampMs);
  }

  // multiplier on spawn budget and on-screen cap, growing slowly once the curve has levelled off
  private getOvertime(): number {
    return 1 + Math.max(0, this.elapsed() - constants.overtimeStartMs) / constants.overtimeMs;
  }

  // time survived outside boss waves
  private elapsed(): number {
    const now = this.scene.time.now;
    const paused = this.pausedMs + (this.isBossWave ? now - this.bossWaveStartedAt : 0);
    return now - this.startTime - paused;
  }

  private startWave(): void {
    this.wave++;
    this.isBossWave = this.wave % constants.bossEveryWaves === 0;
    this.waveEndsAt = this.scene.time.now + constants.waveDurationMs;
    // every wave builds up from nothing
    this.threatBank = 0;
    this.onWaveStart(this.wave, this.isBossWave);
    if (this.isBossWave) {
      this.bossWaveStartedAt = this.scene.time.now;
      this.boss.spawn(this.wave / constants.bossEveryWaves);
    }
  }

  // the boss is beaten: restart the difficulty clock and go to the break before the next wave
  private endBossWave(): void {
    const now = this.scene.time.now;
    this.pausedMs += now - this.bossWaveStartedAt;
    this.isBossWave = false;
    this.waveEndsAt = now;
  }

  private tick(): void {
    // the boss fights alone
    if (this.isBossWave) {
      if (this.boss.active) return;
      this.endBossWave();
    }

    // between waves nothing spawns and no budget builds up, so the screen can clear
    const now = this.scene.time.now;
    if (now >= this.waveEndsAt) {
      if (now < this.waveEndsAt + constants.waveBreakMs) return;
      this.startWave();
    }

    const difficulty = this.getDifficulty();
    const overtime = this.getOvertime();
    const earned = scale(constants.threatPerSecond, difficulty) * overtime * (constants.spawnTickMs / 1000);
    this.threatBank = Math.min(this.threatBank + earned, constants.maxBankedThreat);

    const cost = constants.enemyThreatCost[this.nextKind];
    if (this.threatBank < cost || this.scene.time.now < this.nextSpawnAt) return;
    if (this.threatOnScreen() + cost > scale(constants.maxThreatOnScreen, difficulty) * overtime) return;
    if (!this.spawn(this.nextKind, difficulty)) return;

    this.threatBank -= cost;
    this.nextSpawnAt = this.scene.time.now + constants.minSpawnGapMs;
    this.nextKind = pickWeighted(constants.enemyKindWeights, difficulty);
  }

  private threatOnScreen(): number {
    return this.enemies
      .getMatching('active', true)
      .reduce((sum, enemy) => sum + constants.enemyThreatCost[(enemy as EnemyShip).kind], 0);
  }

  // returns false when the pool is exhausted
  private spawn(kind: EnemyKind, difficulty: number): boolean {
    const width = constants.width;
    const margin = Math.min(constants.enemySpawnMargin, width / 2);
    const x = Phaser.Math.Between(margin, width - margin);
    const behavior = this.pickBehavior(kind, difficulty);

    // tanks are slower in both directions
    const speedFactor = kind === 'tank' ? constants.tankSpeedMultiplier : 1;
    const fireIntervalMs = difficulty < constants.enemyFireStartDifficulty
      ? 0
      : scale(constants.enemyFireIntervalMs, difficulty) *
        (kind === 'gunner' ? constants.gunnerFireIntervalMultiplier : 1);

    // Obtain an enemy from the pool (or create if none free)
    const enemy = this.enemies.get(x, 0, 'enemy') as EnemyShip;
    if (!enemy) {
      return false;
    }

    // configure first, so the hull size is set before placing the enemy
    enemy.setTarget(this.player);
    enemy.configure({
      kind,
      behavior,
      speed: scale(constants.enemySpeed, difficulty) * speedFactor,
      lateralSpeed: scale(constants.enemyLateralSpeed, difficulty) * speedFactor,
      swayAmplitude: scale(constants.enemySwayAmplitude, difficulty),
      swayFrequency: scale(constants.enemySwayFrequency, difficulty),
      evasionScale: scale(constants.enemyEvasionScale, difficulty),
      diveChancePerSecond: scale(constants.enemyDiveChance, difficulty),
      fireIntervalMs,
    }, this.enemyProjectiles);
    // reactivate, resetting the body to just above the top edge so the enemy slides in
    enemy.enableBody(true, x, -enemy.hullHeight / 2, true, true);
    return true;
  }

  // tanks fall straight and gunners hover; only normal enemies get a random movement
  private pickBehavior(kind: EnemyKind, difficulty: number): EnemyBehavior {
    if (kind === 'tank') return 'basic';
    if (kind === 'gunner') return 'hover';
    return pickWeighted(constants.enemyBehaviorWeights, difficulty);
  }

  public getGroup(): Phaser.Physics.Arcade.Group {
    return this.enemies;
  }
}
