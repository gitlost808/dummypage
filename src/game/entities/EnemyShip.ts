import Phaser from "phaser";
import { Ship } from "./Ship";
import { PlayerShip } from "./PlayerShip";
import { constants } from "../constants";
import { EnemyProjectile, EnemyProjectileTexture } from "./EnemyProjectile";
import { playSound, randomDetune } from "../utils/audio";
import { glowTextureKey } from "../utils/glow";
import { LegendEntry } from "./LegendEntry";
import { spriteSizes, textureResolution } from '../utils/texture-resolution';

export type EnemyBehavior = "basic" | "strafer" | "diver" | "hover";
// what the enemy is (movement comes from its behavior)
export type EnemyKind = "normal" | "tank" | "gunner";
// straight down, one shot aimed at the player, or an aimed fan
export type EnemyShot = "straight" | "aimed" | "fan";

// every kind of enemy; the title screen legend lists them all
export const enemyKinds: Record<EnemyKind, LegendEntry & { hp: number; points: number }> = {
  normal: {
    name: "Fighter",
    description: "One hit kills it. Some chase you, some dive",
    texture: "enemy",
    color: constants.enemyColor,
    hp: 1,
    points: constants.pointsPerHit,
  },
  tank: {
    name: "Tank",
    description: `Slow and tough: takes ${constants.tankHp} hits to destroy`,
    texture: "enemy-tank",
    color: constants.tankColor,
    hp: constants.tankHp,
    points: constants.tankPoints,
  },
  gunner: {
    name: "Gunner",
    description: "Hovers near the top and fires aimed shots",
    texture: "enemy-gunner",
    color: constants.gunnerColor,
    hp: 1,
    points: constants.gunnerPoints,
  },
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
  shot: EnemyShot;
  // part of a row falling in step: no drifting or dodging, so the row holds together
  formation: boolean;
};

export class EnemyShip extends Ship {
  private target!: PlayerShip;
  private projectilePool: Phaser.Physics.Arcade.Group | null = null;
  private fireTimer?: Phaser.Time.TimerEvent;
  private flashTimer?: Phaser.Time.TimerEvent;
  private hp = 1;
  // The glow adds visual padding; gameplay sizes always refer to the hull.
  public hullWidth = 0;
  public hullHeight = 0;

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
    shot: "straight",
    formation: false,
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

  // taken off the fall speed after a hit that didn't kill (see damage), fading out
  private recoilVy = 0;

  // hover state: descend to hoverY, stay until hoverEndsAt (0 until arrived), then leave upwards
  private hoverY = 0;
  private hoverEndsAt = 0;
  private isLeaving = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "enemy", 0);
    // enemies enter above the screen and leave below it, so only clamp x (in update)
    this.setCollideWorldBounds(false);
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
    const hull = spriteSizes[kind.texture];
    this.hullWidth = hull.width;
    this.hullHeight = hull.height;
    // the baked glow is missing under the canvas renderer
    const glowTexture = glowTextureKey(kind.texture);
    this.setTexture(this.scene.textures.exists(glowTexture) ? glowTexture : kind.texture);
    this.setDisplaySize(this.width / textureResolution, this.height / textureResolution);
    // centred on the texture, so it covers the hull and not the glow
    (this.body as Phaser.Physics.Arcade.Body).setSize(hull.width / this.scaleX, hull.height / this.scaleY);
    this.clearTint();
    this.hp = kind.hp;
    this.diveState = "none";
    this.diveStateEndsAt = 0;
    this.swayPhase = Phaser.Math.FloatBetween(0, Math.PI * 2);
    // tanks and formations fall straight
    this.driftVx = profile.kind === "tank" || profile.formation
      ? 0
      : Phaser.Math.FloatBetween(-constants.enemyDriftSpeed, constants.enemyDriftSpeed);
    this.hoverY = Phaser.Math.FloatBetween(constants.gunnerHoverYMin, constants.gunnerHoverYMax) * constants.height;
    this.hoverEndsAt = 0;
    this.isLeaving = false;
    this.recoilVy = 0;
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

    // knocked back, so the next hits can land before it reaches the player
    this.recoilVy = this.profile.speed * constants.tankRecoil;

    // flash white, then darken to show the remaining hit points
    this.flashWhite();
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
    // setTint keeps the tint mode, so undo a white flash explicitly
    this.setTint(Phaser.Display.Color.GetColor(v, v, v)).setTintMode(Phaser.TintModes.MULTIPLY);
  }

  private flashWhite(): void {
    this.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
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
      else {
        this.recoilVy = this.eased(this.recoilVy, 0, dt);
        this.setVelocityY(this.profile.speed - this.recoilVy);
      }
      if (this.isEvading) {
        this.steerX(this.evasionDir * constants.evasionSpeed, dt);
      } else {
        this.handleBehavior(dt);
        this.maybeStartWindup(delta);
      }
    }

    this.clampToPlayfieldWidth();

    // off-screen clean up: below the screen, or above it once a gunner has left
    if (this.y > constants.height + this.hullHeight || (this.isLeaving && this.y < -this.hullHeight)) {
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

  // the body ignores world bounds (see constructor), so keep it in the playfield horizontally here
  private clampToPlayfieldWidth(): void {
    const halfW = this.hullWidth / 2;
    const maxX = constants.width - halfW;
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
      const width = constants.width;
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
        if (lit) this.flashWhite();
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
    // tanks and formations don't dodge
    if (!this.scene || this.profile.kind === "tank" || this.profile.formation) {
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
    // a diving ship outruns any shot it fires, and it is the threat itself, so it holds fire
    if (this.diveState === "diving") return;

    const y = this.y + this.hullHeight * 0.5;

    if (this.profile.shot === "straight") {
      // fire straight down (mirrors player straight up), always pulling ahead of the ship
      const fallSpeed = (this.body as Phaser.Physics.Arcade.Body).velocity.y;
      const speed = Math.max(constants.enemyProjectileSpeed, fallSpeed + constants.enemyProjectileMinLead);
      if (this.fireBullet("enemy-projectile", y, Math.PI / 2, speed)) playSound(this.scene, "enemy-shoot", randomDetune());
      return;
    }

    // tanks descend past the player, so hold fire before their shots become point-blank or lateral
    if (this.profile.kind === "tank" && this.target.y - y < constants.tankMinFireHeight) return;

    // aim at the player with some jitter; tanks have a narrower downward arc than hovering gunners.
    // A fan is clamped as a whole, so its outer shots stay inside the downward arc too
    const minAngle = this.profile.kind === "tank" ? constants.tankMinAimAngle : constants.gunnerMinAimAngle;
    const shots = this.profile.shot === "fan" ? constants.gunnerFanShots : 1;
    const halfArc = ((shots - 1) / 2) * constants.gunnerFanSpread;
    const jitter = Phaser.Math.FloatBetween(-constants.gunnerAimJitter, constants.gunnerAimJitter);
    const center = Phaser.Math.Clamp(
      Math.atan2(this.target.y - y, this.target.x - this.x) + jitter,
      minAngle + halfArc,
      Math.PI - minAngle - halfArc
    );
    let fired = false;
    for (let i = 0; i < shots; i++) {
      const angle = center - halfArc + i * constants.gunnerFanSpread;
      fired = this.fireBullet("enemy-projectile-aimed", y, angle, constants.gunnerProjectileSpeed) || fired;
    }
    if (fired) playSound(this.scene, "enemy-shoot", randomDetune());
  }

  // returns false when the pool is exhausted
  private fireBullet(texture: EnemyProjectileTexture, y: number, angle: number, speed: number): boolean {
    const bullet = this.projectilePool?.get(this.x, y) as EnemyProjectile | null;
    if (!bullet) return false;
    bullet.reset(this.x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, texture);
    return true;
  }

  preDestroy(): void {
    this.cancelTimers();
    super.preDestroy();
  }
}
