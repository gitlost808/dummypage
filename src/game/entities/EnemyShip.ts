import Phaser from "phaser";
import { Ship } from "./Ship";
import { PlayerShip } from "./PlayerShip";
import { constants } from "../constants";
import { EnemyProjectile } from "./EnemyProjectile";
import { playSound, randomDetune } from "../utils/audio";

type EnemyBehavior = "basic" | "strafer" | "diver";
// what the enemy is (movement comes from its behavior)
export type EnemyKind = "normal" | "tank" | "gunner";

const enemyKinds: Record<EnemyKind, { texture: string; color: number; hp: number; points: number }> = {
  normal: { texture: "enemy", color: constants.enemyColor, hp: 1, points: constants.pointsPerHit },
  tank: { texture: "enemy-tank", color: constants.tankColor, hp: constants.tankHp, points: constants.tankPoints },
  gunner: { texture: "enemy-gunner", color: constants.gunnerColor, hp: 1, points: constants.gunnerPoints },
};

type EnemyProfile = {
  kind: EnemyKind;
  behavior: EnemyBehavior;
  speed: number;
  swayAmplitude: number;
  swayFrequency: number;
  trackStrength: number;
  evasionScale: number;
  diveChancePerSecond: number;
  fireIntervalMs: number;
};

export class EnemyShip extends Ship {
  private target!: PlayerShip;
  private projectilePool: Phaser.Physics.Arcade.Group | null = null;
  private fireTimer?: Phaser.Time.TimerEvent;
  private flashTimer?: Phaser.Time.TimerEvent;
  private hp = 1;

  private profile: EnemyProfile = {
    kind: "normal",
    behavior: "basic",
    speed: constants.enemyBaseSpeed,
    swayAmplitude: 0,
    swayFrequency: 0,
    trackStrength: 1,
    evasionScale: 1,
    diveChancePerSecond: 0,
    fireIntervalMs: constants.enemyFireIntervalBase,
  };

  // new evasion state
  private isEvading = false;
  private evasionDir: -1 | 1 = 1;
  private evasionTimer?: Phaser.Time.TimerEvent;

  // dive state
  private isDiving = false;
  private diveEndsAt = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "enemy", 0);
    this.addGlow(constants.enemyColor);
    this.scheduleNextEvasion();
  }

  public setTarget(target: PlayerShip): void {
    this.target = target;
  }

  public configure(
    profile: EnemyProfile,
    projectilePool: Phaser.Physics.Arcade.Group
  ): void {
    this.profile = profile;
    this.speed = profile.speed;
    // reset all state, since pooled enemies get reused
    const kind = enemyKinds[profile.kind];
    this.setTexture(kind.texture);
    (this.body as Phaser.Physics.Arcade.Body).setSize();
    this.clearTint();
    if (this.glow) this.glow.color = kind.color;
    this.hp = kind.hp;
    this.isDiving = false;
    this.diveEndsAt = 0;
    this.isEvading = false;
    this.setVelocity(0, 0);
    this.projectilePool = projectilePool;
    this.cancelTimers();
    this.scheduleNextEvasion();
    this.scheduleFire();
  }

  public get color(): number {
    return enemyKinds[this.profile.kind].color;
  }

  public get points(): number {
    return enemyKinds[this.profile.kind].points;
  }

  // apply one hit; returns true when the enemy is out of hit points
  public damage(): boolean {
    this.hp--;
    if (this.hp <= 0) return true;

    // flash white, then darken to show the remaining hit points
    this.setTintFill(0xffffff);
    if (this.flashTimer) this.flashTimer.remove(false);
    this.flashTimer = this.scene.time.delayedCall(constants.enemyHitFlashMs, () => {
      const v = Math.round(255 * (0.5 + (0.5 * this.hp) / enemyKinds[this.profile.kind].hp));
      this.setTint(Phaser.Display.Color.GetColor(v, v, v));
    });
    return false;
  }

  // return to the pool; stop timers so an inactive enemy can't fire or evade
  public despawn(): void {
    this.cancelTimers();
    this.disableBody(true, true);
  }

  private cancelTimers(): void {
    if (this.fireTimer) this.fireTimer.remove(false);
    if (this.evasionTimer) this.evasionTimer.remove(false);
    if (this.flashTimer) this.flashTimer.remove(false);
    this.fireTimer = undefined;
    this.evasionTimer = undefined;
    this.flashTimer = undefined;
  }

  update(): void {
    const delta = this.scene.game.loop.delta;

    // always move down
    this.setVelocityY(this.profile.speed);

    // horizontally, choose based on behavior state
    if (this.isDiving) {
      this.handleDive();
    } else if (this.isEvading) {
      this.setVelocityX(this.evasionDir * constants.evasionSpeed);
    } else {
      this.handleBehavior();
      this.maybeStartDive(delta);
    }


    // exit dive when time is up
    if (this.isDiving && this.scene.time.now >= this.diveEndsAt) {
      this.isDiving = false;
    }

    // off-screen clean up
    if (this.y > this.scene.scale.height + this.height) {
      this.despawn();
    }
  }

  private handleBehavior(): void {
    if (!this.target) return;

    const targetX = this.target.x;
    const freq = this.profile.swayFrequency;

    let desiredX = targetX;

    if (this.profile.behavior === "strafer" || this.profile.behavior === "diver") {
      // add sinusoidal sway that ramps with difficulty
      const sway = Math.sin(this.scene.time.now * freq) * this.profile.swayAmplitude;
      desiredX += sway;
    }

    const dirX = Math.sign(desiredX - this.x);
    this.setVelocityX(dirX * this.profile.speed * this.profile.trackStrength);
  }

  private maybeStartDive(delta: number): void {
    if (this.profile.behavior !== "diver") return;

    const chance = this.profile.diveChancePerSecond * (delta / 1000);
    if (Math.random() < chance) {
      this.startDive();
    }
  }

  private startDive(): void {
    if (!this.target) return;

    this.isDiving = true;
    const duration = Phaser.Math.Between(
      constants.enemyDiveDurationMin,
      constants.enemyDiveDurationMax
    );
    this.diveEndsAt = this.scene.time.now + duration;
  }

  private handleDive(): void {
    if (!this.target) return;

    const dx = this.target.x - this.x;
    const dy = this.target.y - this.y;
    const len = Math.hypot(dx, dy) || 1;
    const speed = this.profile.speed * constants.enemyDiveSpeedMultiplier;

    this.setVelocity((dx / len) * speed, (dy / len) * speed);
  }

  private scheduleNextEvasion(): void {
    if (!this.scene) {
      return;
    }
    const scale = this.profile.evasionScale || 1;
    const min = constants.evasionIntervalMin / scale;
    const max = constants.evasionIntervalMax / scale;
    const delay = Phaser.Math.Between(
      min,
      max,
    );
    if (this.evasionTimer) {
      this.evasionTimer.remove(false);
    }
    this.evasionTimer = this.scene.time.delayedCall(delay, () => {
      this.startEvasion();
    });
  }

  private startEvasion(): void {
    // don’t do anything if we’ve been destroyed
    if (!this.scene || !this.active) {
      return;
    }

    this.isEvading = true;
    this.evasionDir = Phaser.Math.RND.sign() as -1 | 1;

    const scale = this.profile.evasionScale || 1;
    const duration = Phaser.Math.Between(
      constants.evasionDurationMin,
      constants.evasionDurationMax,
    ) / Math.max(scale, 0.5);
    // track the end-of-evasion timer so it can be cancelled too
    this.evasionTimer = this.scene.time.delayedCall(duration, () => {
      if (!this.active) return;
      this.isEvading = false;
      this.scheduleNextEvasion();
    });
  }

  private scheduleFire(): void {
    if (!this.scene || !this.projectilePool) return;
    if (this.profile.fireIntervalMs <= 0) return;
    const delay = Phaser.Math.Between(
      this.profile.fireIntervalMs * 0.7,
      this.profile.fireIntervalMs * 1.1
    );
    this.fireTimer = this.scene.time.delayedCall(delay, () => {
      this.fireProjectile();
      this.scheduleFire();
    });
  }

  private fireProjectile(): void {
    if (!this.active || !this.projectilePool || !this.target) return;

    const y = this.y + this.height * 0.5;
    const aimed = this.profile.kind === "gunner";
    const bullet = this.projectilePool.get(this.x, y) as EnemyProjectile;
    if (!bullet) return;

    // pooled bullets keep their last texture, so always set it (and the body size)
    bullet.setTexture(aimed ? "enemy-projectile-aimed" : "enemy-projectile");
    (bullet.body as Phaser.Physics.Arcade.Body).setSize();
    playSound(this.scene, "enemy-shoot", randomDetune());

    if (!aimed) {
      // fire straight down (mirrors player straight up)
      bullet.reset(this.x, y, 0, constants.enemyProjectileSpeed);
      return;
    }

    // aim at the player with some jitter; always keep a downward component
    // so the bullet leaves through the bottom of the screen
    const jitter = Phaser.Math.FloatBetween(-constants.gunnerAimJitter, constants.gunnerAimJitter);
    const angle = Phaser.Math.Clamp(
      Math.atan2(this.target.y - y, this.target.x - this.x) + jitter,
      constants.gunnerMinAimAngle,
      Math.PI - constants.gunnerMinAimAngle
    );
    const speed = constants.gunnerProjectileSpeed;
    bullet.reset(this.x, y, Math.cos(angle) * speed, Math.sin(angle) * speed);
  }

  preDestroy(): void {
    this.cancelTimers();
    super.preDestroy();
  }
}
