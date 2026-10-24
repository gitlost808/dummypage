import Phaser from 'phaser';

const highScoreKey = 'galactic-skirmish:highScore';

// storage can be unavailable (private mode, blocked site data), so never throw
function loadHighScore(): number {
  try {
    const value = Number(localStorage.getItem(highScoreKey));
    return Number.isFinite(value) && value >= 0 ? value : 0;
  } catch {
    return 0;
  }
}

function saveHighScore(value: number): void {
  try {
    localStorage.setItem(highScoreKey, String(value));
  } catch {
    // ignore, the high score just won't survive a reload
  }
}

export class ScoreSystem {
  private scene: Phaser.Scene;
  private scoreText: Phaser.GameObjects.Text;
  private highScoreText: Phaser.GameObjects.Text;

  private score = 0;
  private highScore = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    this.highScore = Math.max(loadHighScore(), scene.registry.get('highScore') ?? 0);

    this.scoreText = scene.add.text(10, 10, 'Score: 0', {
      fontSize: '20px',
      color: '#ffffff',
    });

    this.highScoreText = scene.add.text(10, 40, `High Score: ${this.highScore}`, {
      fontSize: '20px',
      color: '#ffff00',
    });

    scene.registry.set('score', this.score);
    scene.registry.set('highScore', this.highScore);

    scene.time.addEvent({
      delay: 1000,
      loop: true,
      callback: this.incrementScore,
      callbackScope: this,
    });
  }

  private incrementScore(): void {
    this.addPoints(1);
  }

  public getScore(): number {
    return this.score;
  }

  public addPoints(points: number): void {
    this.score += points;
    this.scoreText.setText(`Score: ${this.score}`);
    this.scene.registry.set('score', this.score);

    if (this.score > this.highScore) {
      this.highScore = this.score;
      this.scene.registry.set('highScore', this.highScore);
      this.highScoreText.setText(`High Score: ${this.highScore}`);
      saveHighScore(this.highScore);
    }
  }

  public get text(): Phaser.GameObjects.Text {
    return this.scoreText;
  }
}
