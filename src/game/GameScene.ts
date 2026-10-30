import Phaser from 'phaser';
import { constants } from './constants';
import { PlayerShip } from './entities/PlayerShip';
import { Projectile } from './entities/Projectile';
import { EnemyProjectile } from './entities/EnemyProjectile';
import { EnemyShip } from './entities/EnemyShip';
import { Boss } from './entities/Boss';
import { LaserBeam } from './entities/LaserBeam';
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
import { MusicButton } from './ui/MusicButton';
import { VolumeSlider } from './ui/VolumeSlider';
import { PauseButton } from './ui/PauseButton';
import { WaveBanner } from './ui/WaveBanner';
import { BossHealthBar } from './ui/BossHealthBar';
import { playMusic, playSound, randomDetune, stopMusic } from './utils/audio';
import { fitPlayfieldCamera } from './utils/playfield';
import { RunSetup, openRunDialog } from './leaderboard/dialogs';
import { LeaderboardSession } from './leaderboard/client';

export default class GameScene extends Phaser.Scene {
  private inputType!: CombinedInput;
  private touch!: TouchInput;
  private player!: PlayerShip;
  private projectiles!: Phaser.Physics.Arcade.Group;
  private enemyProjectiles!: Phaser.Physics.Arcade.Group;
  private scoreSystem!: ScoreSystem;
  private enemySpawner!: EnemySpawner;
  private powerUps!: PowerUpSystem;
  private effects!: EffectsSystem;
  private gameOverOverlay?: GameOverOverlay;
  private muteButton!: MuteButton;
  private musicButton!: MusicButton;
  private pauseButton!: PauseButton;
  private volumeSlider!: VolumeSlider;
  private waveBanner!: WaveBanner;
  private boss!: Boss;
  private bossHealthBar!: BossHealthBar;
  // left and right edges of the playfield, redrawn on resize (see fitCamera)
  private playfieldBorder!: Phaser.GameObjects.Graphics;
  private laser!: LaserBeam;
  private isGameOver = false;
  private nextFireAt = 0;
  private nextLaserTickAt = 0;
  private leaderboardSession?: LeaderboardSession;

  constructor() {
    super('GameScene');
  }

  init(data: RunSetup): void {
    this.leaderboardSession = data?.session;
  }

  create(): void {
    // scene.restart() reuses this instance, so reset per-run state
    this.isGameOver = false;
    this.gameOverOverlay = undefined;
    this.nextFireAt = 0;
    this.nextLaserTickAt = 0;
    // gameOver() pauses the clock, and the Clock plugin survives the restart
    this.time.paused = false;
    playMusic(this, 'main');

    // the playfield has a fixed size; the camera scales it to fit the window (see fitCamera)
    this.playfieldBorder = this.add.graphics();
    this.fitCamera(this.scale.width, this.scale.height);
    this.physics.world.setBounds(0, 0, constants.width, constants.height);

    // keyboard and touch always work together; a mouse click counts as a touch
    this.touch = new TouchInput(this);
    // keyboard players don't need the touch hints
    this.input.keyboard.once('keydown', () => this.touch.fadeHints());
    const inputs: InputController[] = [new KeyboardInput(this), this.touch];
    this.inputType = new CombinedInput(inputs);

    const startX = constants.width / 2;
    const startY = constants.height - constants.bottomMargin;
    this.player = new PlayerShip(this, startX, startY, this.inputType);
    this.laser = new LaserBeam(this);

    // projectile pool
    this.projectiles = Projectile.createPool(this);
    this.enemyProjectiles = EnemyProjectile.createPool(this);

    // systems
    this.scoreSystem = new ScoreSystem(this);
    this.waveBanner = new WaveBanner(this);
    this.boss = new Boss(this, this.player, this.enemyProjectiles);
    this.bossHealthBar = new BossHealthBar(this);
    this.enemySpawner = new EnemySpawner(this, this.player, this.enemyProjectiles, this.boss, (wave, isBoss, escalation) => {
      this.waveBanner.show(wave, isBoss, escalation);
      if (!isBoss) return;
      playSound(this, 'boss-warn');
      playMusic(this, 'boss', true);
    });
    this.powerUps = new PowerUpSystem(
      this,
      this.player,
      () => this.enemySpawner.getDifficulty(),
      () => this.detonateBomb()
    );
    this.effects = new EffectsSystem(this);
    this.muteButton = new MuteButton(this);
    this.musicButton = new MusicButton(this);
    this.pauseButton = new PauseButton(this, () => this.pause());
    this.volumeSlider = new VolumeSlider(this, 3);

    // collisions; checked pair by pair, so a second hit in the frame the shield breaks is skipped too
    const canHitPlayer = () => !this.player.isInvulnerable;
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
      canHitPlayer,
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
      canHitPlayer,
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
        if (ship.damage()) return this.destroyEnemy(ship);
        // survived the hit: just a few sparks
        this.effects.explode(x, y, 0xffffff, constants.enemyHitSparkParticles);
        playSound(this, 'enemy-hit');
      },
      undefined,
      this
    );
    // the player can't reach the boss's height, so only its shots can touch it
    this.physics.add.overlap(
      this.boss,
      this.projectiles,
      (_boss, proj) => {
        // several shots can land in the frame the boss dies
        if (!this.boss.active) return;
        const { x, y } = proj as Projectile;
        (proj as Projectile).disableBody(true, true);
        if (this.damageBoss()) return;
        this.effects.explode(x, y, 0xffffff, constants.enemyHitSparkParticles);
        playSound(this, 'enemy-hit');
      },
      undefined,
      this
    );

    // everything lives in playfield coordinates, so a resize only refits the camera
    const onResize = (gameSize: Phaser.Structs.Size) => this.fitCamera(gameSize.width, gameSize.height);

    // a phone switching apps or a window losing focus pauses the run, so nothing happens while
    // the player is away
    const autoPause = () => this.pause();
    this.game.events.on(Phaser.Core.Events.HIDDEN, autoPause);
    this.game.events.on(Phaser.Core.Events.BLUR, autoPause);
    this.events.on(Phaser.Scenes.Events.RESUME, this.onResume, this);

    // the ScaleManager, the game and the scene's own events outlive this scene, so detach on shutdown/restart
    this.scale.on('resize', onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', onResize, this);
      this.game.events.off(Phaser.Core.Events.HIDDEN, autoPause);
      this.game.events.off(Phaser.Core.Events.BLUR, autoPause);
      this.events.off(Phaser.Scenes.Events.RESUME, this.onResume, this);
    });
  }

  // freeze the whole scene (physics, clock, tweens, updates) under the pause screen
  private pause(): void {
    // already paused, or nothing left to pause
    if (this.isGameOver || !this.scene.isActive()) return;
    // a finger lifted while paused never reaches this scene
    this.touch.release();
    this.sound.pauseAll();
    this.scene.pause();
    this.scene.launch('PauseScene');
  }

  private onResume(): void {
    this.sound.resumeAll();
    // the pause screen has audio controls of its own, and the pause button drew its play icon
    this.muteButton.redraw();
    this.musicButton.redraw();
    this.pauseButton.redraw();
    this.volumeSlider.redraw();
  }

  // nothing clips the playfield, so objects that leave it despawn instead
  private fitCamera(width: number, height: number): void {
    const zoom = fitPlayfieldCamera(this.cameras.main, width, height);

    // only the sides get a border, running the full height of the window, including any space
    // below the playfield, since enemies enter at the top and bullets leave at the bottom
    const bottom = height / zoom;
    this.playfieldBorder
      .clear()
      .lineStyle(2, constants.playfieldBorderColor, constants.playfieldBorderAlpha)
      .lineBetween(0, 0, 0, bottom)
      .lineBetween(constants.width, 0, constants.width, bottom);

    this.gameOverOverlay?.fitBackdrop(width / zoom, height / zoom);
  }

  update(): void {
    if (this.isGameOver) return;

    this.player.update();
    this.powerUps.update();
    this.boss.update();
    this.bossHealthBar.update(this.boss.active ? this.boss.hpFraction : null);

    // fire while held; a buffered press fires as soon as the cooldown allows
    const wantsFire = this.inputType.fire || this.inputType.firePressed;
    if (this.powerUps.isActive('laser')) {
      if (wantsFire) this.laser.fire();
      this.inputType.firePressed = false;
      this.updateLaser();
      return;
    }
    // the gun takes over the moment the laser runs out
    this.laser.stop();
    if (wantsFire && this.time.now >= this.nextFireAt) {
      this.spawnProjectiles();
      this.inputType.firePressed = false;
      this.nextFireAt = this.time.now + constants.fireCooldownMs;
    }
  }

  // the beam passes through enemies, killing each one it touches whatever its hit points, but stops at
  // the boss, which takes damage in ticks so its hit flash flickers instead of hiding its attack blink
  private updateLaser(): void {
    const { x } = this.player;
    const nose = this.player.y - 16;
    const underside = this.boss.active ? this.boss.undersideAt(x) : undefined;
    this.laser.update(x, nose, underside ?? 0, underside !== undefined);
    if (!this.laser.isOn) return;

    this.enemySpawner.getGroup().getMatching('active', true).forEach((enemy) => {
      const ship = enemy as EnemyShip;
      if (this.laser.overlaps(ship.body as Phaser.Physics.Arcade.Body)) this.destroyEnemy(ship);
    });

    if (underside === undefined || this.time.now < this.nextLaserTickAt) return;
    this.nextLaserTickAt = this.time.now + constants.laserBossTickMs;
    if (this.damageBoss(constants.laserBossDamage)) return;
    this.effects.explode(x, underside, constants.laserColor, constants.enemyHitSparkParticles);
  }

  private destroyEnemy(ship: EnemyShip): void {
    const { x, y } = ship;
    ship.despawn();
    this.effects.explode(x, y, ship.color);
    playSound(this, 'explosion', randomDetune());
    this.powerUps.maybeDrop(x, y);
    this.scoreSystem.addPoints(ship.points);
  }

  private spawnProjectiles(): void {
    const velocities = this.powerUps.isActive('spread')
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
    // the boss just takes a chunk of damage
    if (this.boss.active) this.damageBoss(this.boss.maxHp * constants.bossBombDamage);
    this.cameras.main.flash(250, 203, 75, 22);
    this.effects.shake(constants.bombShakeMs, constants.bombShakeIntensity);
    playSound(this, 'big-explosion');
  }

  // returns true when the boss is beaten. Nothing else drops power-ups during a boss wave, so each
  // phase the boss enters drops one
  private damageBoss(amount?: number): boolean {
    const phase = this.boss.phaseIndex;
    if (this.boss.damage(amount)) {
      this.defeatBoss();
      return true;
    }
    if (this.boss.phaseIndex > phase) this.powerUps.drop(this.boss.x, this.boss.y);
    return false;
  }

  private defeatBoss(): void {
    const { x, y, displayWidth, displayHeight } = this.boss;
    this.boss.despawn();
    // its bullets go down with it
    this.enemyProjectiles
      .getMatching('active', true)
      .forEach((bullet) => (bullet as EnemyProjectile).disableBody(true, true));
    // a chain of blasts across the hull
    for (let i = 0; i < constants.bossDeathExplosions; i++) {
      this.time.delayedCall(i * constants.bossDeathExplosionGapMs, () => {
        const bx = x + Phaser.Math.FloatBetween(-0.4, 0.4) * displayWidth;
        const by = y + Phaser.Math.FloatBetween(-0.4, 0.4) * displayHeight;
        this.effects.explode(bx, by, i % 2 ? 0xffffff : constants.bossColor);
        playSound(this, 'explosion', randomDetune());
      });
    }
    this.effects.explode(x, y, constants.bossColor, constants.explosionDeathParticles);
    this.effects.shake(constants.bombShakeMs, constants.bombShakeIntensity);
    playSound(this, 'big-explosion');
    playMusic(this, 'main', true);
    // always a shield: a bomb would go off on an empty screen, and a spread would run out during the
    // break. Nothing drops if the shield is already full
    this.powerUps.drop(x, y, 'shield');
    this.scoreSystem.addPoints(this.boss.points);
  }

  private gameOver(): void {
    // overlap callbacks can fire repeatedly in the same frame
    if (this.isGameOver) return;
    this.isGameOver = true;

    // freeze the action: physics, plus the clock driving spawns, firing and score
    this.physics.pause();
    this.time.paused = true;
    // Group updates keep running when physics and timers pause, letting divers sound warnings.
    this.enemySpawner.getGroup().runChildUpdate = false;

    // blow up the player; particles and camera effects keep running while paused
    this.player.setVisible(false);
    // nothing left to pause
    this.pauseButton.setVisible(false);
    this.laser.stop();
    this.effects.explode(
      this.player.x,
      this.player.y,
      constants.playerColor,
      constants.explosionDeathParticles
    );
    this.effects.shake(constants.deathShakeMs, constants.deathShakeIntensity);
    playSound(this, 'big-explosion');
    playSound(this, 'game-over');
    stopMusic(this);

    this.gameOverOverlay = new GameOverOverlay(
      this,
      this.scoreSystem.getScore(),
      this.registry.get('highScore') ?? 0,
      async () => {
        const setup = await openRunDialog(this);
        if (setup && this.scene.isActive()) this.scene.restart(setup);
      },
      this.leaderboardSession
    );
  }
}
