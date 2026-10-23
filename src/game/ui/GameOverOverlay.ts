import Phaser from 'phaser';
import { constants } from '../constants';

const toHex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

export class GameOverOverlay extends Phaser.GameObjects.Container {
  private backdrop: Phaser.GameObjects.Rectangle;
  private title: Phaser.GameObjects.Text;
  private scoreText: Phaser.GameObjects.Text;
  private highScoreText: Phaser.GameObjects.Text;
  private prompt: Phaser.GameObjects.Text;

  private readyAt: number;
  private restarting = false;

  constructor(
    scene: Phaser.Scene,
    score: number,
    highScore: number,
    onRestart: () => void
  ) {
    super(scene, 0, 0);
    scene.add.existing(this);
    this.setDepth(100).setScrollFactor(0);

    this.backdrop = scene.add
      .rectangle(0, 0, 1, 1, 0x000000, constants.gameOverBackdropAlpha)
      .setOrigin(0);
    this.title = scene.add
      .text(0, 0, 'GAME OVER', {
        fontSize: '48px',
        color: toHex(constants.gameOverColor),
      })
      .setOrigin(0.5);
    this.scoreText = scene.add
      .text(0, 0, `Score: ${score}`, { fontSize: '24px', color: '#ffffff' })
      .setOrigin(0.5);
    this.highScoreText = scene.add
      .text(0, 0, `High Score: ${highScore}`, {
        fontSize: '20px',
        color: '#ffff00',
      })
      .setOrigin(0.5);
    this.prompt = scene.add
      .text(0, 0, 'Press SPACE or tap to restart', {
        fontSize: '16px',
        color: '#cccccc',
      })
      .setOrigin(0.5)
      .setAlpha(0);

    this.add([
      this.backdrop,
      this.title,
      this.scoreText,
      this.highScoreText,
      this.prompt,
    ]);
    this.layout(scene.scale.width, scene.scale.height);

    // fade in; tweens run even while the scene clock is paused
    this.setAlpha(0);
    scene.tweens.add({ targets: this, alpha: 1, duration: 200 });

    // ignore restart input briefly so a mashed fire button can't skip the screen
    this.readyAt = scene.time.now + constants.gameOverInputDelayMs;
    scene.tweens.add({
      targets: this.prompt,
      alpha: 1,
      delay: constants.gameOverInputDelayMs,
      duration: 300,
    });

    const restart = () => {
      if (this.restarting || this.scene.time.now < this.readyAt) return;
      this.restarting = true;
      onRestart();
    };
    // require a fresh press: a fire key held through death auto-repeats keydown,
    // and a finger still held down never emits another pointerdown
    const onKey = (event: KeyboardEvent) => {
      if (!event.repeat) restart();
    };
    scene.input.keyboard.on('keydown-SPACE', onKey);
    scene.input.keyboard.on('keydown-ENTER', onKey);
    scene.input.on('pointerdown', restart);
  }

  layout(width: number, height: number): void {
    const cx = width / 2;
    const cy = height / 2;
    this.backdrop.setSize(width, height);
    this.title.setPosition(cx, cy - 70);
    this.scoreText.setPosition(cx, cy - 10);
    this.highScoreText.setPosition(cx, cy + 25);
    this.prompt.setPosition(cx, cy + 80);
  }
}
