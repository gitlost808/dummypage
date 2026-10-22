import Phaser from "phaser";
import { Ship } from "./Ship";
import { PlayerShip } from "./PlayerShip";
import { constants } from "../constants";
import { EnemyProjectile } from "./EnemyProjectile";

type EnemyBehavior = "basic" | "strafer" | "diver";

type EnemyProfile = {
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

  private profile: EnemyProfile = {
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
    this.isDiving = false;
    this.isEvading = false;
    this.projectilePool = projectilePool;
    if (this.evasionTimer) {
      this.evasionTimer.remove(false);
    }
    if (this.fireTimer) {
      this.fireTimer.remove(false);
    }
    this.scheduleNextEvasion();
    this.scheduleFire();
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
      this.destroy();
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

    const bullet = this.projectilePool.get(this.x, this.y + this.height * 0.5, 'enemy-projectile') as EnemyProjectile;
    if (!bullet) return;

    bullet.setActive(true).setVisible(true);
    (bullet.body as Phaser.Physics.Arcade.Body).enable = true;

    // fire straight down (mirrors player straight up)
    bullet.reset(this.x, this.y + this.height * 0.5, 0, constants.enemyProjectileSpeed);
  }

  preDestroy(): void {
    if (this.fireTimer) this.fireTimer.remove(false);
    if (this.evasionTimer) this.evasionTimer.remove(false);
    super.preDestroy();
  }
}
