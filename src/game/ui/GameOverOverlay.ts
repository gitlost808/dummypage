import Phaser from 'phaser';
import { constants } from '../constants';
import { LeaderboardError, LeaderboardRun } from '../leaderboard/client';
import { openLeaderboardDialog } from '../leaderboard/dialogs';

const toHex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

export class GameOverOverlay extends Phaser.GameObjects.Container {
  private backdrop: Phaser.GameObjects.Rectangle;
  private title: Phaser.GameObjects.Text;
  private scoreText: Phaser.GameObjects.Text;
  private highScoreText: Phaser.GameObjects.Text;
  private prompt: Phaser.GameObjects.Text;
  private saveStatus: Phaser.GameObjects.Text;
  private retryButton: Phaser.GameObjects.Text;
  private readonly saveController = new AbortController();
  private saving = false;

  private readyAt: number;
  private restarting = false;

  constructor(
    scene: Phaser.Scene,
    score: number,
    highScore: number,
    onRestart: () => Promise<void>,
    run?: LeaderboardRun
  ) {
    super(scene, 0, 0);
    scene.add.existing(this);
    this.setDepth(100);

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

    this.saveStatus = scene.add.text(0, 0, '', {
      fontSize: '15px',
      color: '#cccccc',
      align: 'center',
      wordWrap: { width: constants.width - 70 },
    }).setOrigin(0.5);
    this.retryButton = scene.add.text(0, 0, 'RETRY SAVE', {
      fontSize: '16px', color: '#859900',
    }).setOrigin(0.5).setPadding(10).setInteractive({ useHandCursor: true }).setVisible(false);
    const leaderboardButton = scene.add.text(0, 0, 'LEADERBOARD (L)', {
      fontSize: '18px', color: '#268bd2',
    }).setOrigin(0.5).setPadding(12).setInteractive({ useHandCursor: true });
    leaderboardButton.setPosition(constants.width / 2, constants.height / 2 + 190);
    leaderboardButton.on('pointerdown', () => openLeaderboardDialog(scene, run?.session.session_id));
    scene.input.keyboard.on('keydown-L', (event: KeyboardEvent) => {
      if (!event.repeat) openLeaderboardDialog(scene, run?.session.session_id);
    });

    this.add([
      this.backdrop,
      this.title,
      this.scoreText,
      this.highScoreText,
      this.prompt,
      this.saveStatus,
      this.retryButton,
      leaderboardButton,
    ]);
    this.layout();
    const camera = scene.cameras.main;
    this.fitBackdrop(camera.width / camera.zoom, camera.height / camera.zoom);

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

    const restart = async () => {
      if (this.restarting || this.scene.time.now < this.readyAt) return;
      this.restarting = true;
      try {
        await onRestart();
      } finally {
        this.restarting = false;
      }
    };
    // require a fresh press: a fire key held through death auto-repeats keydown,
    // and a finger still held down never emits another pointerdown
    const onKey = (event: KeyboardEvent) => {
      if (!event.repeat) restart();
    };
    scene.input.keyboard.on('keydown-SPACE', onKey);
    scene.input.keyboard.on('keydown-ENTER', onKey);
    // taps on UI such as the mute button shouldn't restart
    scene.input.on(
      'pointerdown',
      (_pointer: Phaser.Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[]) => {
        if (currentlyOver.length === 0) restart();
      }
    );

    // One immutable result per run; the run retries temporary failures itself, and the retry
    // button sends the same score again, as required by the API.
    const save = async () => {
      if (!run || this.saving || this.saveController.signal.aborted) return;
      this.saving = true;
      this.retryButton.setVisible(false);
      this.saveStatus.setText('Saving score…');
      try {
        await run.finish(score, this.saveController.signal);
        if (!this.saveController.signal.aborted) this.saveStatus.setText('Score saved to leaderboard');
      } catch (error) {
        if (this.saveController.signal.aborted) return;
        this.saveStatus.setText(error.message);
        this.retryButton.setVisible(error instanceof LeaderboardError && error.retryable);
      } finally {
        this.saving = false;
      }
    };
    this.retryButton.on('pointerdown', save);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.saveController.abort());
    if (run) void save();
    else this.saveStatus.setText('Offline run • personal best kept on this device');
  }

  // cover the whole window, not just the playfield, so the bars around it on tall or wide screens
  // are dimmed too. The view is in playfield units, centred horizontally and aligned to the top;
  // a little extra on each side keeps the edges hidden while the death shake moves the camera
  public fitBackdrop(viewWidth: number, viewHeight: number): void {
    const width = viewWidth * 1.1;
    const height = viewHeight * 1.1;
    this.backdrop
      .setPosition((constants.width - width) / 2, (viewHeight - height) / 2)
      .setSize(width, height);
  }

  private layout(): void {
    const cx = constants.width / 2;
    const cy = constants.height / 2;
    this.title.setPosition(cx, cy - 110);
    this.scoreText.setPosition(cx, cy - 50);
    this.highScoreText.setPosition(cx, cy - 15);
    this.saveStatus.setPosition(cx, cy + 45);
    this.retryButton.setPosition(cx, cy + 105);
    this.prompt.setPosition(cx, cy + 145);
  }
}
