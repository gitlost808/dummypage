import Phaser from 'phaser';
import { constants } from './constants';
import { PlayerShip } from './entities/PlayerShip';
import { Projectile } from './entities/Projectile';
import { EnemyProjectile } from './entities/EnemyProjectile';
import { EnemyShip } from './entities/EnemyShip';
import { Starfield } from './entities/Starfield';
import { ScoreSystem } from './systems/ScoreSystem';
import { EnemySpawner } from './systems/EnemySpawner';
import { PowerUpSystem } from './systems/PowerUpSystem';
import { EffectsSystem } from './systems/EffectsSystem';
import { KeyboardInput } from './input/KeyboardInput';
import { TouchInput } from './input/TouchInput';
import { CombinedInput } from './input/CombinedInput';
import { InputController } from './input/InputController';
import { GameOverOverlay } from './ui/GameOverOverlay';
import { MuteButton } from './ui/MuteButton';
import { WaveBanner } from './ui/WaveBanner';
import { playSound, randomDetune } from './utils/audio';

export default class GameScene extends Phaser.Scene {
  private inputType!: CombinedInput;
  private player!: PlayerShip;
  private projectiles!: Phaser.Physics.Arcade.Group;
  private enemyProjectiles!: Phaser.Physics.Arcade.Group;
  private starfield!: Starfield;
  private scoreSystem!: ScoreSystem;
  private enemySpawner!: EnemySpawner;
  private powerUps!: PowerUpSystem;
  private effects!: EffectsSystem;
  private gameOverOverlay?: GameOverOverlay;
  private muteButton!: MuteButton;
  private waveBanner!: WaveBanner;
  private isGameOver = false;
  private nextFireAt = 0;

  constructor() {
    super('GameScene');
  }

  create(): void {
    // scene.restart() reuses this instance, so reset per-run state
    this.isGameOver = false;
    this.gameOverOverlay = undefined;
    this.nextFireAt = 0;
    // gameOver() pauses the clock, and the Clock plugin survives the restart
    this.time.paused = false;

    // keyboard always works; add touch controls when touch is supported
    // (touch-capable desktops report touch too, so it can't replace the keyboard)
    const inputs: InputController[] = [new KeyboardInput(this)];
    if (this.sys.game.device.input.touch) {
      const touch = new TouchInput(this);
      inputs.push(touch);
      // keyboard players don't need the touch hints
      this.input.keyboard.once('keydown', () => touch.fadeHints());
    }
    this.inputType = new CombinedInput(inputs);

    // visuals
    this.starfield = new Starfield(this);

    const startX = this.scale.width / 2;
    const startY = this.scale.height - constants.bottomMargin;
    this.player = new PlayerShip(this, startX, startY, this.inputType);

    // projectile pool
    this.projectiles = Projectile.createPool(this);
    this.enemyProjectiles = EnemyProjectile.createPool(this);

    // systems
    this.scoreSystem = new ScoreSystem(this);
    this.waveBanner = new WaveBanner(this);
    this.enemySpawner = new EnemySpawner(this, this.player, this.enemyProjectiles, (wave) =>
      this.waveBanner.show(wave)
    );
    this.powerUps = new PowerUpSystem(this, this.player, () =>
      this.detonateBomb()
    );
    this.effects = new EffectsSystem(this);
    this.muteButton = new MuteButton(this);

    // collisions
    this.physics.add.overlap(
      this.player,
      this.enemySpawner.getGroup(),
      (_player, enemy) => {
        if (!this.player.absorbHit()) return this.gameOver();
        // ramming with the shield kills outright, whatever the enemy's hit points
        const ship = enemy as EnemyShip;
        const { x, y } = ship;
        ship.despawn();
        this.effects.explode(x, y, ship.color);
        this.effects.shake(constants.shieldHitShakeMs, constants.shieldHitShakeIntensity);
        playSound(this, 'shield-hit');
        playSound(this, 'explosion', randomDetune());
        this.scoreSystem.addPoints(ship.points);
      },
      undefined,
      this
    );
    this.physics.add.overlap(
      this.player,
      this.enemyProjectiles,
      (_player, bullet) => {
        if (!this.player.absorbHit()) return this.gameOver();
        const { x, y } = bullet as EnemyProjectile;
        (bullet as EnemyProjectile).disableBody(true, true);
        this.effects.explode(x, y, constants.shieldColor, constants.explosionSmallParticles);
        playSound(this, 'shield-hit');
      },
      undefined,
      this
    );
    this.physics.add.overlap(
      this.projectiles,
      this.enemySpawner.getGroup(),
      (proj, enemy) => {
        const ship = enemy as EnemyShip;
        const { x, y } = ship;
        // return the projectile to its pool instead of destroying it
        (proj as Projectile).disableBody(true, true);
        if (!ship.damage()) {
          // survived the hit: just a few sparks
          this.effects.explode(x, y, 0xffffff, constants.enemyHitSparkParticles);
          playSound(this, 'enemy-hit');
          return;
        }
        ship.despawn();
        this.effects.explode(x, y, ship.color);
        playSound(this, 'explosion', randomDetune());
        this.powerUps.maybeDrop(x, y);
        this.scoreSystem.addPoints(ship.points);
      },
      undefined,
      this
    );
    
    const onResize = (gameSize: Phaser.Structs.Size) => {
      const { width, height } = gameSize;

      // resize starfield
      this.starfield.setSize(width, height);

      // move score
      this.scoreSystem.setPosition(10, 10);

      // keep the player's x (clamped to the new width), only move y
      const halfW = this.player.displayWidth / 2;
      this.player.setPosition(
        Phaser.Math.Clamp(this.player.x, halfW, width - halfW),
        height - constants.bottomMargin
      );

      // (and camera/world bounds if you’re using them)
      this.physics.world.setBounds(0, 0, width, height);
      this.cameras.main.setBounds(0, 0, width, height);

      this.muteButton.layout(width);
      this.waveBanner.layout(width, height);

      // keep the game-over screen centred
      this.gameOverOverlay?.layout(width, height);
    };

    // the ScaleManager outlives this scene, so detach on shutdown/restart
    this.scale.on('resize', onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', onResize, this);
    });
  }

  update(): void {
    this.starfield.update();
    if (this.isGameOver) return;

    this.player.update();
    this.powerUps.update();

    // fire while held; a buffered press fires as soon as the cooldown allows
    const wantsFire = this.inputType.fire || this.inputType.firePressed;
    if (wantsFire && this.time.now >= this.nextFireAt) {
      this.spawnProjectiles();
      this.inputType.firePressed = false;
      this.nextFireAt = this.time.now + constants.fireCooldownMs;
    }
  }

  private spawnProjectiles(): void {
    const velocities = this.powerUps.isSpreadActive()
      ? [-constants.spreadVelocityX, 0, constants.spreadVelocityX]
      : [0];
    for (const vx of velocities) this.spawnProjectile(vx);
    playSound(this, 'shoot', randomDetune());
  }

  private spawnProjectile(vx: number): void {
    const { x, y } = this.player;
    const proj = this.projectiles.get(x, y - 16) as Projectile;
    if (!proj) return;
    proj.reset(x, y - 16, vx);
  }

  private detonateBomb(): void {
    // return everything on screen to the pools; bombs ignore hit points
    let points = 0;
    this.enemySpawner.getGroup().getMatching('active', true).forEach((enemy) => {
      const ship = enemy as EnemyShip;
      const { x, y } = ship;
      points += ship.points;
      ship.despawn();
      this.effects.explode(x, y, constants.bombColor);
    });
    this.enemyProjectiles
      .getMatching('active', true)
      .forEach((bullet) => (bullet as EnemyProjectile).disableBody(true, true));
    this.scoreSystem.addPoints(points);
    this.cameras.main.flash(250, 203, 75, 22);
    this.effects.shake(constants.bombShakeMs, constants.bombShakeIntensity);
    playSound(this, 'big-explosion');
  }

  private gameOver(): void {
    // overlap callbacks can fire repeatedly in the same frame
    if (this.isGameOver) return;
    this.isGameOver = true;

    // freeze the action: physics, plus the clock driving spawns, firing and score
    this.physics.pause();
    this.time.paused = true;

    // blow up the player; particles and camera effects keep running while paused
    this.player.setVisible(false);
    this.effects.explode(
      this.player.x,
      this.player.y,
      constants.playerColor,
      constants.explosionDeathParticles
    );
    this.effects.shake(constants.deathShakeMs, constants.deathShakeIntensity);
    playSound(this, 'big-explosion');
    playSound(this, 'game-over');

    this.gameOverOverlay = new GameOverOverlay(
      this,
      this.scoreSystem.getScore(),
      this.registry.get('highScore') ?? 0,
      () => this.scene.restart()
    );
  }
}
