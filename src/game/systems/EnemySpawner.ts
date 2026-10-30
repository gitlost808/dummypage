import Phaser from 'phaser';
import { EnemyShip, EnemyKind, EnemyBehavior, EnemyShot, enemyKinds } from '../entities/EnemyShip';
import { PlayerShip } from '../entities/PlayerShip';
import { Boss } from '../entities/Boss';
import { constants } from '../constants';

type Range = [number, number];
type Unlockable = { unlockAt: number; weight: Range };
type Escalation = keyof typeof constants.escalations;
// the next spawn: one enemy, or a formation of normal ones
type SpawnPick = EnemyKind | 'formation';
// escalation is the banner line for a threat the last boss unlocked
export type WaveStartListener = (wave: number, isBoss: boolean, escalation?: string) => void;

// interpolate an [easy, hard] range by difficulty
export function scale([easy, hard]: Range, difficulty: number): number {
  return easy + (hard - easy) * difficulty;
}

function threatCost(pick: SpawnPick): number {
  return pick === 'formation'
    ? constants.formationSize * constants.enemyThreatCost.normal
    : constants.enemyThreatCost[pick];
}

function spawnMargin(): number {
  return Math.min(constants.enemySpawnMargin, constants.width / 2);
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
  private next: SpawnPick = 'normal';
  private nextSpawnAt = 0;

  private wave = 0;
  private waveEndsAt = 0;
  private onWaveStart: WaveStartListener;

  // boss waves last until the boss is beaten, and the difficulty clock stands still meanwhile
  private boss: Boss;
  private isBossWave = false;
  private bossWaveStartedAt = 0;
  private pausedMs = 0;

  // each boss beaten unlocks the next escalation; its banner line waits for the next wave
  private bossesBeaten = 0;
  private escalationNews?: string;

  constructor(
    scene: Phaser.Scene,
    player: PlayerShip,
    enemyProjectiles: Phaser.Physics.Arcade.Group,
    boss: Boss,
    onWaveStart: WaveStartListener
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
    this.onWaveStart(this.wave, this.isBossWave, this.escalationNews);
    this.escalationNews = undefined;
    if (this.isBossWave) {
      this.bossWaveStartedAt = this.scene.time.now;
      this.boss.spawn(this.wave / constants.bossEveryWaves);
    }
  }

  // the boss is beaten: restart the difficulty clock, unlock the next escalation and go to the break
  // before the next wave
  private endBossWave(): void {
    const now = this.scene.time.now;
    this.pausedMs += now - this.bossWaveStartedAt;
    this.isBossWave = false;
    this.waveEndsAt = now;
    this.bossesBeaten++;
    this.escalationNews = Object.values(constants.escalations).find(
      ({ bosses }) => bosses === this.bossesBeaten
    )?.banner;
  }

  private isUnlocked(escalation: Escalation): boolean {
    return this.bossesBeaten >= constants.escalations[escalation].bosses;
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

    const cost = threatCost(this.next);
    if (this.threatBank < cost || this.scene.time.now < this.nextSpawnAt) return;
    if (this.threatOnScreen() + cost > scale(constants.maxThreatOnScreen, difficulty) * overtime) return;
    const spawned = this.next === 'formation' ? this.spawnFormation(difficulty) : this.spawn(this.next, difficulty);
    if (!spawned) return;

    this.threatBank -= cost;
    this.nextSpawnAt = this.scene.time.now + constants.minSpawnGapMs;
    this.next = this.pickNext(difficulty);
  }

  private pickNext(difficulty: number): SpawnPick {
    const kind = pickWeighted(constants.enemyKindWeights, difficulty);
    const formation = kind === 'normal' && this.isUnlocked('formations') && Math.random() < constants.formationChance;
    return formation ? 'formation' : kind;
  }

  private threatOnScreen(): number {
    return this.enemies
      .getMatching('active', true)
      .reduce((sum, enemy) => sum + constants.enemyThreatCost[(enemy as EnemyShip).kind], 0);
  }

  // a row of normal enemies side by side, falling in step; returns false only if none could spawn
  private spawnFormation(difficulty: number): boolean {
    const step = this.scene.textures.getFrame(enemyKinds.normal.texture).width + constants.formationGap;
    const rowWidth = step * (constants.formationSize - 1);
    const left = Phaser.Math.Between(spawnMargin(), constants.width - spawnMargin() - rowWidth);
    let spawned = false;
    for (let i = 0; i < constants.formationSize; i++) {
      spawned = this.spawn('normal', difficulty, left + i * step, true) || spawned;
    }
    return spawned;
  }

  // returns false when the pool is exhausted
  private spawn(
    kind: EnemyKind,
    difficulty: number,
    x = Phaser.Math.Between(spawnMargin(), constants.width - spawnMargin()),
    formation = false
  ): boolean {
    const behavior = formation ? 'basic' : this.pickBehavior(kind, difficulty);
    const shot = this.pickShot(kind);

    // tanks are slower in both directions
    const speedFactor = kind === 'tank' ? constants.tankSpeedMultiplier : 1;
    const fireIntervalMs = difficulty < constants.enemyFireStartDifficulty
      ? 0
      : scale(constants.enemyFireIntervalMs, difficulty) *
        (shot === 'straight' ? 1 : constants.gunnerFireIntervalMultiplier);

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
      shot,
      formation,
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

  // gunners aim and tanks fire straight down, until escalations sharpen both
  private pickShot(kind: EnemyKind): EnemyShot {
    if (kind === 'gunner') return this.isUnlocked('gunnerFans') ? 'fan' : 'aimed';
    if (kind === 'tank' && this.isUnlocked('aimedTanks')) return 'aimed';
    return 'straight';
  }

  public getGroup(): Phaser.Physics.Arcade.Group {
    return this.enemies;
  }
}
