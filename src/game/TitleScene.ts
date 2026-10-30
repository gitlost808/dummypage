import Phaser from 'phaser';
import { constants } from './constants';
import { Legend } from './ui/Legend';
import { MuteButton } from './ui/MuteButton';
import { MusicButton } from './ui/MusicButton';
import { VolumeSlider } from './ui/VolumeSlider';
import { fitPlayfieldCamera } from './utils/playfield';
import { openLeaderboardDialog, openRunDialog } from './leaderboard/dialogs';

const toHex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

// shown once at launch, before the first run: the game's name and a legend of what's in it.
// Restarts after game over skip the title screen and open the pilot form.
export default class TitleScene extends Phaser.Scene {
  private starting = false;

  constructor() {
    super('TitleScene');
  }

  create(): void {
    this.starting = false;
    fitPlayfieldCamera(this.cameras.main, this.scale.width, this.scale.height);
    const cx = constants.width / 2;

    this.add
      .text(cx, constants.titleY, 'GALACTIC\nSKIRMISH', {
        fontSize: '52px',
        color: toHex(constants.titleColor),
        align: 'center',
      })
      .setOrigin(0.5);

    const legend = new Legend(this, constants.titleLegendY);

    const prompt = this.add
      .text(cx, constants.titleLegendY + legend.height + 70, 'Press SPACE or tap to start', {
        fontSize: '18px',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    this.tweens.add({ targets: prompt, alpha: 0.3, duration: 700, yoyo: true, repeat: -1 });

    this.add
      .text(cx, prompt.y + 45, 'LEADERBOARD (L)', { fontSize: '18px', color: '#268bd2' })
      .setOrigin(0.5)
      .setPadding(12)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => openLeaderboardDialog(this));
    this.input.keyboard.on('keydown-L', (event: KeyboardEvent) => {
      if (!event.repeat) openLeaderboardDialog(this);
    });

    // so sound and music can be set before the first run
    new MuteButton(this);
    new MusicButton(this);
    new VolumeSlider(this);

    // a held key auto-repeats keydown; wait for a fresh press
    const onKey = (event: KeyboardEvent) => {
      if (!event.repeat) void this.startRun();
    };
    this.input.keyboard.on('keydown-SPACE', onKey);
    this.input.keyboard.on('keydown-ENTER', onKey);
    // taps on the audio controls shouldn't start the game
    this.input.on('pointerdown', (_pointer: Phaser.Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[]) => {
      if (currentlyOver.length === 0) void this.startRun();
    });

    // the ScaleManager outlives this scene, so detach once the game starts
    const onResize = (gameSize: Phaser.Structs.Size) =>
      fitPlayfieldCamera(this.cameras.main, gameSize.width, gameSize.height);
    this.scale.on('resize', onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', onResize, this);
    });
  }

  private async startRun(): Promise<void> {
    if (this.starting) return;
    this.starting = true;
    const setup = await openRunDialog(this);
    this.starting = false;
    if (setup && this.scene.isActive()) this.scene.start('GameScene', setup);
  }
}
