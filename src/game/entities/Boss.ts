import Phaser from 'phaser';
import { Ship } from './Ship';
import { PlayerShip } from './PlayerShip';
import { EnemyProjectile } from './EnemyProjectile';
import { LegendEntry } from './LegendEntry';
import { constants } from '../constants';
import { playSound, randomDetune } from '../utils/audio';
import { bossCannons, bossUnderside } from '../utils/texture-generator';

type BossAttack = (typeof constants.bossPhases)[number]['attacks'][number];

// one boss, reused for every encounter: it slides in, patrols the top of the screen and cycles
// through telegraphed attacks that get fiercer as it loses hit points
export class Boss extends Ship {
  public static readonly legend: LegendEntry = {
    name: 'Boss',
    description: `Every ${constants.bossEveryWaves}th wave. Gets fiercer as it weakens`,
    texture: 'boss',
    color: constants.bossColor,
  };

  private target: PlayerShip;
  private projectilePool: Phaser.Physics.Arcade.Group;
  private attackTimer?: Phaser.Time.TimerEvent;
  private burstTimer?: Phaser.Time.TimerEvent;

  private hp = 0;
  private hpMax = 0;
  private encounter = 1;
  private isEntering = false;
  private patrolPhase = 0;
  // a hit flash and the pre-attack blink both whiten the hull; update() applies whichever is on
  private flashUntil = 0;
  private telegraphing = false;

  constructor(scene: Phaser.Scene, target: PlayerShip, projectilePool: Phaser.Physics.Arcade.Group) {
    super(scene, constants.width / 2, 0, Boss.legend.texture, 0);
    this.target = target;
    this.projectilePool = projectilePool;
    // enters from above the screen
    this.setCollideWorldBounds(false);
    this.addGlow(constants.bossColor);
    this.disableBody(true, true);
  }

  // encounter counts from 1 and scales hit points and attack rate
  public spawn(encounter: number): void {
    this.encounter = encounter;
    this.hpMax = Math.round(constants.bossHp * (1 + (encounter - 1) * constants.bossHpGrowth));
    this.hp = this.hpMax;
    this.isEntering = true;
    this.telegraphing = false;
    this.flashUntil = 0;
    // a quarter turn, so the patrol starts out heading to one side instead of easing out of the centre
    this.patrolPhase = Phaser.Math.RND.sign() * Math.PI / 2;
    this.cancelTimers();
    this.enableBody(true, constants.width / 2, -this.displayHeight / 2, true, true);
    this.setVelocity(0, constants.bossEntrySpeed);
  }

  public get points(): number {
    return constants.bossPoints * this.encounter;
  }

  public get maxHp(): number {
    return this.hpMax;
  }

  public get hpFraction(): number {
    return this.hp / this.hpMax;
  }

  // apply damage; returns true when the boss is out of hit points
  public damage(amount = 1): boolean {
    this.hp = Math.max(0, this.hp - amount);
    this.flashUntil = this.scene.time.now + constants.enemyHitFlashMs;
    return this.hp <= 0;
  }

  // the world y of the hull's underside (or a cannon's muzzle) at world x, undefined where x misses the hull
  public undersideAt(x: number): number | undefined {
    const tx = x - this.x + this.displayWidth * this.originX;
    const top = this.y - this.displayHeight * this.originY;
    const cannon = bossCannons.find(({ left, right }) => tx >= left && tx <= right);
    if (cannon) return top + cannon.bottom;
    for (let i = 1; i < bossUnderside.length; i++) {
      const [x0, y0] = bossUnderside[i - 1];
      const [x1, y1] = bossUnderside[i];
      if (tx >= x0 && tx <= x1) return top + Phaser.Math.Linear(y0, y1, (tx - x0) / (x1 - x0));
    }
    return undefined;
  }

  public despawn(): void {
    this.cancelTimers();
    this.disableBody(true, true);
  }

  update(): void {
    if (!this.active) return;
    const dt = this.scene.game.loop.delta / 1000;

    if (this.isEntering) {
      if (this.y >= constants.height * constants.bossHoverY) {
        this.isEntering = false;
        this.setVelocityY(0);
        this.scheduleAttack(constants.bossFirstAttackDelayMs);
      }
    } else {
      this.patrol(dt);
    }

    const lit = this.telegraphing || this.scene.time.now < this.flashUntil;
    if (lit) this.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    else this.clearTint();
  }

  // 0 at full hit points, one more for each threshold passed
  public get phaseIndex(): number {
    const fraction = this.hpFraction;
    return constants.bossPhaseThresholds.filter((threshold) => fraction < threshold).length;
  }

  private get phase() {
    return constants.bossPhases[this.phaseIndex];
  }

  // sway across the top of the screen, faster in later phases
  private patrol(dt: number): void {
    const speed = this.phase.patrolSpeed;
    this.patrolPhase += this.scene.game.loop.delta * constants.bossPatrolFrequency * speed;
    const desiredX = constants.width / 2 + Math.sin(this.patrolPhase) * constants.width * constants.bossPatrolSpread;
    const maxVx = constants.bossLateralSpeed * speed;
    const desiredVx = Phaser.Math.Clamp((desiredX - this.x) * constants.enemyTrackGain, -maxVx, maxVx);
    const vx = (this.body as Phaser.Physics.Arcade.Body).velocity.x;
    this.setVelocityX(vx + (desiredVx - vx) * (1 - Math.exp(-constants.enemySteerRate * dt)));
  }

  private scheduleAttack(delay: number): void {
    this.attackTimer = this.scene.time.delayedCall(delay, () => this.telegraph());
  }

  // blink and play a warning, then attack with whatever the phase is by then
  private telegraph(): void {
    this.telegraphing = true;
    playSound(this.scene, 'dive-warn');
    this.attackTimer = this.scene.time.delayedCall(constants.bossTelegraphMs, () => {
      this.telegraphing = false;
      const phase = this.phase;
      this.attack(Phaser.Utils.Array.GetRandom(phase.attacks), phase);
      const rate = 1 + (this.encounter - 1) * constants.bossAttackRateGrowth;
      this.scheduleAttack(phase.cooldownMs / rate);
    });
  }

  private attack(attack: BossAttack, phase: (typeof constants.bossPhases)[number]): void {
    switch (attack) {
      case 'burst':
        // a quick string of aimed shots, each re-aimed at the player
        this.burstTimer = this.scene.time.addEvent({
          delay: constants.bossBurstGapMs,
          repeat: phase.burstShots - 1,
          startAt: constants.bossBurstGapMs,
          callback: () => this.fire(this.aimAngle(), constants.bossProjectileSpeed),
        });
        break;
      case 'fan': {
        const center = this.aimAngle();
        for (let i = 0; i < phase.fanShots; i++) {
          const offset = (i / (phase.fanShots - 1) - 0.5) * constants.bossFanArc;
          this.fire(center + offset, constants.bossProjectileSpeed);
        }
        break;
      }
      case 'ring': {
        const start = Math.random() * Math.PI * 2;
        for (let i = 0; i < constants.bossRingShots; i++) {
          this.fire(start + (i / constants.bossRingShots) * Math.PI * 2, constants.bossRingSpeed);
        }
        break;
      }
    }
  }

  // towards the player, kept pointing downwards like the gunner's shots
  private aimAngle(): number {
    return Phaser.Math.Clamp(
      Math.atan2(this.target.y - this.y, this.target.x - this.x),
      constants.gunnerMinAimAngle,
      Math.PI - constants.gunnerMinAimAngle
    );
  }

  private fire(angle: number, speed: number): void {
    if (!this.active) return;
    const y = this.y + this.displayHeight * 0.3;
    const bullet = this.projectilePool.get(this.x, y) as EnemyProjectile;
    if (!bullet) return;
    bullet.reset(this.x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, 'boss-projectile');
    playSound(this.scene, 'enemy-shoot', randomDetune());
  }

  private cancelTimers(): void {
    this.attackTimer?.remove(false);
    this.burstTimer?.remove(false);
    this.attackTimer = undefined;
    this.burstTimer = undefined;
  }

  preDestroy(): void {
    this.cancelTimers();
    super.preDestroy();
  }
}
