import Phaser from 'phaser';
import { constants } from './constants';
import { MuteButton } from './ui/MuteButton';
import { MusicButton } from './ui/MusicButton';
import { PauseButton } from './ui/PauseButton';
import { VolumeSlider } from './ui/VolumeSlider';
import { fitPlayfieldCamera } from './utils/playfield';

const toHex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

// shown over the frozen GameScene, which launches it. The audio controls work here too, and any
// other tap, P, Esc, Space or Enter resumes the run
export default class PauseScene extends Phaser.Scene {
  private backdrop!: Phaser.GameObjects.Rectangle;

  constructor() {
    super('PauseScene');
  }

  create(): void {
    this.backdrop = this.add.rectangle(0, 0, 1, 1, 0x000000, constants.pauseBackdropAlpha).setOrigin(0);
    this.fitCamera(this.scale.width, this.scale.height);

    const cx = constants.width / 2;
    const cy = constants.height / 2;
    this.add
      .text(cx, cy - 30, 'PAUSED', { fontSize: '48px', color: toHex(constants.pauseColor) })
      .setOrigin(0.5);
    const prompt = this.add
      .text(cx, cy + 30, 'Press P or tap to resume', { fontSize: '18px', color: '#ffffff' })
      .setOrigin(0.5);
    this.tweens.add({ targets: prompt, alpha: 0.3, duration: 700, yoyo: true, repeat: -1 });

    new PauseButton(this, () => this.resumeGame());
    new MuteButton(this);
    new MusicButton(this);
    new VolumeSlider(this, 3);

    // a held key auto-repeats keydown; wait for a fresh press
    const onKey = (event: KeyboardEvent) => {
      if (!event.repeat) this.resumeGame();
    };
    this.input.keyboard.on('keydown-SPACE', onKey);
    this.input.keyboard.on('keydown-ENTER', onKey);
    // taps on the audio controls shouldn't resume
    this.input.on('pointerdown', (_pointer: Phaser.Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[]) => {
      if (currentlyOver.length === 0) this.resumeGame();
    });

    // the ScaleManager outlives this scene, so detach once the game resumes
    const onResize = (gameSize: Phaser.Structs.Size) => this.fitCamera(gameSize.width, gameSize.height);
    this.scale.on('resize', onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', onResize, this);
    });
  }

  // the backdrop dims the whole window, bars around the playfield included
  private fitCamera(width: number, height: number): void {
    const zoom = fitPlayfieldCamera(this.cameras.main, width, height);
    const viewWidth = width / zoom;
    const viewHeight = height / zoom;
    this.backdrop
      .setPosition((constants.width - viewWidth) / 2, (constants.height - viewHeight) / 2)
      .setSize(viewWidth, viewHeight);
  }

  private resumeGame(): void {
    this.scene.resume('GameScene');
    this.scene.stop();
  }
}
