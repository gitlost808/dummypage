import Phaser from "phaser";
import { Ship } from "./Ship";
import { PlayerShip } from "./PlayerShip";
import { constants } from "../constants";
import { EnemyProjectile } from "./EnemyProjectile";
import { playSound, randomDetune } from "../utils/audio";

export type EnemyBehavior = "basic" | "strafer" | "diver" | "hover";
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
  lateralSpeed: number;
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
    speed: constants.enemySpeed[0],
    swayAmplitude: 0,
    swayFrequency: 0,
    lateralSpeed: constants.enemyLateralSpeed[0],
    evasionScale: 1,
    diveChancePerSecond: 0,
    fireIntervalMs: 0,
  };

  // new evasion state
  private isEvading = false;
  private evasionDir: -1 | 1 = 1;
  private evasionTimer?: Phaser.Time.TimerEvent;

  // dive state: a telegraphed wind-up, then a dive in a fixed direction
  private diveState: "none" | "windup" | "diving" = "none";
  private diveStateEndsAt = 0;
  private blinkTimer?: Phaser.Time.TimerEvent;

  // per-enemy sway offset, so strafers don't all sway in unison
  private swayPhase = 0;

  // basic enemies drift sideways at this speed instead of tracking the player
  private driftVx = 0;

  // hover state: descend to hoverY, stay until hoverEndsAt (0 until arrived), then leave upwards
  private hoverY = 0;
  private hoverEndsAt = 0;
  private isLeaving = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "enemy", 0);
    // enemies enter above the screen and leave below it, so only clamp x (in update)
    this.setCollideWorldBounds(false);
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
    this.diveState = "none";
    this.diveStateEndsAt = 0;
    this.swayPhase = Phaser.Math.FloatBetween(0, Math.PI * 2);
    // tanks fall straight
    this.driftVx = profile.kind === "tank"
      ? 0
      : Phaser.Math.FloatBetween(-constants.enemyDriftSpeed, constants.enemyDriftSpeed);
    this.hoverY = Phaser.Math.FloatBetween(constants.gunnerHoverYMin, constants.gunnerHoverYMax) * this.scene.scale.height;
    this.hoverEndsAt = 0;
    this.isLeaving = false;
    this.isEvading = false;
    this.setVelocity(0, 0);
    this.projectilePool = projectilePool;
    this.cancelTimers();
    this.scheduleNextEvasion();
    this.scheduleFire();
  }

  public get kind(): EnemyKind {
    return this.profile.kind;
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
    this.flashTimer = this.scene.time.delayedCall(constants.enemyHitFlashMs, () => this.applyHpTint());
    return false;
  }

  // darken to show the remaining hit points
  private applyHpTint(): void {
    const maxHp = enemyKinds[this.profile.kind].hp;
    if (this.hp >= maxHp) {
      this.clearTint();
      return;
    }
    const v = Math.round(255 * (0.5 + (0.5 * this.hp) / maxHp));
    this.setTint(Phaser.Display.Color.GetColor(v, v, v));
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
    if (this.blinkTimer) this.blinkTimer.remove(false);
    this.fireTimer = undefined;
    this.evasionTimer = undefined;
    this.flashTimer = undefined;
    this.blinkTimer = undefined;
  }

  update(): void {
    const delta = this.scene.game.loop.delta;
    const dt = delta / 1000;
    const now = this.scene.time.now;

    if (this.diveState === "windup") {
      // hang in place while blinking, then dive
      this.setVelocityY(this.profile.speed * constants.enemyDiveWindupSpeedFactor);
      this.steerX(0, dt);
      if (now >= this.diveStateEndsAt) this.startDive();
    } else if (this.diveState === "diving") {
      // velocity was locked in when the dive started
      if (now >= this.diveStateEndsAt) this.diveState = "none";
    } else {
      if (this.profile.behavior === "hover") this.updateHover(dt);
      else this.setVelocityY(this.profile.speed);
      if (this.isEvading) {
        this.steerX(this.evasionDir * constants.evasionSpeed, dt);
      } else {
        this.handleBehavior(dt);
        this.maybeStartWindup(delta);
      }
    }

    this.clampToScreenWidth();

    // off-screen clean up: below the screen, or above it once a gunner has left
    if (this.y > this.scene.scale.height + this.height || (this.isLeaving && this.y < -this.height)) {
      this.despawn();
    }
  }

  // ease the velocity towards the desired one, so turns and stops are smooth arcs
  private steerX(desiredVx: number, dt: number): void {
    const vx = (this.body as Phaser.Physics.Arcade.Body).velocity.x;
    this.setVelocityX(this.eased(vx, desiredVx, dt));
  }

  private steerY(desiredVy: number, dt: number): void {
    const vy = (this.body as Phaser.Physics.Arcade.Body).velocity.y;
    this.setVelocityY(this.eased(vy, desiredVy, dt));
  }

  private eased(current: number, desired: number, dt: number): number {
    return current + (desired - current) * (1 - Math.exp(-constants.enemySteerRate * dt));
  }

  // the body ignores world bounds (see constructor), so keep it on screen horizontally here
  private clampToScreenWidth(): void {
    const halfW = this.displayWidth / 2;
    const maxX = this.scene.scale.width - halfW;
    if (this.x >= halfW && this.x <= maxX) return;
    // drifters bounce off the edge instead of sliding along it
    this.driftVx = this.x < halfW ? Math.abs(this.driftVx) : -Math.abs(this.driftVx);
    this.x = Phaser.Math.Clamp(this.x, halfW, maxX);
    this.setVelocityX(0);
  }

  // gunners descend to their hover height, patrol and fire for a while, then retreat upwards
  private updateHover(dt: number): void {
    const now = this.scene.time.now;
    // close enough: the steering eases in, so it would take a while to reach hoverY exactly
    if (this.hoverEndsAt === 0 && this.y >= this.hoverY - 8) {
      this.hoverEndsAt = now + Phaser.Math.Between(constants.gunnerHoverMsMin, constants.gunnerHoverMsMax);
    }
    if (!this.isLeaving && this.hoverEndsAt > 0 && now >= this.hoverEndsAt) {
      this.isLeaving = true;
      // no parting shots on the way out
      if (this.fireTimer) this.fireTimer.remove(false);
      this.fireTimer = undefined;
    }

    const speed = this.profile.speed;
    const desiredVy = this.isLeaving
      ? -speed
      : Phaser.Math.Clamp((this.hoverY - this.y) * constants.enemyTrackGain, -speed, speed);
    this.steerY(desiredVy, dt);
  }

  private handleBehavior(dt: number): void {
    if (!this.target) return;

    // basic enemies (and tanks) don't track the player, so they don't all line up in its column
    if (this.profile.behavior === "basic") {
      this.steerX(this.driftVx, dt);
      return;
    }

    let desiredX: number;
    if (this.profile.behavior === "hover") {
      // patrol back and forth across the screen
      const width = this.scene.scale.width;
      const patrol = Math.sin(this.scene.time.now * constants.gunnerPatrolFrequency + this.swayPhase);
      desiredX = width / 2 + patrol * width * constants.gunnerPatrolSpread;
    } else {
      // track the player, with a sinusoidal sway that ramps with difficulty
      const sway = Math.sin(this.scene.time.now * this.profile.swayFrequency + this.swayPhase) * this.profile.swayAmplitude;
      desiredX = this.target.x + sway;
    }

    // slow down near the target instead of overshooting, and never outrun the player
    const maxVx = Math.min(this.profile.lateralSpeed, constants.playerSpeed * constants.enemyMaxLateralSpeedRatio);
    const desiredVx = Phaser.Math.Clamp((desiredX - this.x) * constants.enemyTrackGain, -maxVx, maxVx);
    this.steerX(desiredVx, dt);
  }

  private maybeStartWindup(delta: number): void {
    if (this.profile.behavior !== "diver" || !this.target) return;
    // only dive from on screen and well above the player, so a dive is always visible and dodgeable
    if (this.y < 0 || this.y > this.target.y - constants.enemyDiveMinHeight) return;

    const chance = this.profile.diveChancePerSecond * (delta / 1000);
    if (Math.random() < chance) {
      this.startWindup();
    }
  }

  private startWindup(): void {
    this.diveState = "windup";
    this.diveStateEndsAt = this.scene.time.now + constants.enemyDiveWindupMs;
    playSound(this.scene, "dive-warn");

    let lit = false;
    this.blinkTimer = this.scene.time.addEvent({
      delay: constants.enemyDiveBlinkMs,
      loop: true,
      callback: () => {
        lit = !lit;
        if (lit) this.setTintFill(0xffffff);
        else this.applyHpTint();
      },
    });
  }

  private startDive(): void {
    if (this.blinkTimer) this.blinkTimer.remove(false);
    this.blinkTimer = undefined;
    this.applyHpTint();

    if (!this.target) {
      this.diveState = "none";
      return;
    }

    this.diveState = "diving";
    const duration = Phaser.Math.Between(
      constants.enemyDiveDurationMin,
      constants.enemyDiveDurationMax
    );
    this.diveStateEndsAt = this.scene.time.now + duration;

    // aim at where the player is now, then commit: the dive no longer homes
    const angle = Phaser.Math.Clamp(
      Math.atan2(this.target.y - this.y, this.target.x - this.x),
      constants.enemyDiveMinAngle,
      Math.PI - constants.enemyDiveMinAngle
    );
    const speed = this.profile.speed * constants.enemyDiveSpeedMultiplier;
    this.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
  }

  private scheduleNextEvasion(): void {
    // tanks don't dodge
    if (!this.scene || this.profile.kind === "tank") {
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
