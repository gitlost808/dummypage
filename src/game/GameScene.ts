import Phaser from 'phaser';
import { constants } from './constants';
import { PlayerShip } from './entities/PlayerShip';
import { Projectile } from './entities/Projectile';
import { EnemyProjectile } from './entities/EnemyProjectile';
import { EnemyShip } from './entities/EnemyShip';
import { Starfield } from './entities/Starfield';
import { ScoreSystem } from './systems/ScoreSystem';
import { EnemySpawner } from './systems/EnemySpawner';
import { KeyboardInput } from './input/KeyboardInput';
import { TouchInput } from './input/TouchInput';
import { CombinedInput } from './input/CombinedInput';
import { InputController } from './input/InputController';

export default class GameScene extends Phaser.Scene {
  private inputType!: CombinedInput;
  private player!: PlayerShip;
  private projectiles!: Phaser.Physics.Arcade.Group;
  private enemyProjectiles!: Phaser.Physics.Arcade.Group;
  private starfield!: Starfield;
  private scoreSystem!: ScoreSystem;
  private enemySpawner!: EnemySpawner;

  constructor() {
    super('GameScene');
  }

  create(): void {
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
    this.enemySpawner = new EnemySpawner(
      this,
      this.player,
      this.scoreSystem,
      this.enemyProjectiles
    );

    // collisions
    this.physics.add.overlap(
      this.player,
      this.enemySpawner.getGroup(),
      () => this.gameOver(),
      undefined,
      this
    );
    this.physics.add.overlap(
      this.player,
      this.enemyProjectiles,
      () => this.gameOver(),
      undefined,
      this
    );
    this.physics.add.overlap(
      this.projectiles,
      this.enemySpawner.getGroup(),
      (proj, enemy) => {
        // return both to their pools instead of destroying them
        (proj as Projectile).disableBody(true, true);
        (enemy as EnemyShip).despawn();
        this.scoreSystem.addPoints(constants.pointsPerHit);
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
    };

    // the ScaleManager outlives this scene, so detach on shutdown/restart
    this.scale.on('resize', onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', onResize, this);
    });
  }

  update(): void {
    this.starfield.update();
    this.player.update();

    if (this.inputType.shoot) {
      this.spawnProjectile();
      this.inputType.shoot = false;
    }
  }

  private spawnProjectile(): void {
    const { x, y } = this.player;
    const proj = this.projectiles.get(x, y - 16) as Projectile;
    if (!proj) return;
    proj.reset(x, y - 16);
  }

  private gameOver(): void {
    this.scene.restart();
  }
}
