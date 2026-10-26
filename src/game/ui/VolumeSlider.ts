import Phaser from 'phaser';
import { constants } from '../constants';
import { setVolume } from '../utils/audio';
import { size } from './ToggleButton';

const width = 120;
const trackY = 23;

// Master volume, in the same scaled playfield as the other controls.
export class VolumeSlider extends Phaser.GameObjects.Container {
  private track: Phaser.GameObjects.Graphics;
  private valueText: Phaser.GameObjects.Text;
  private pointer?: Phaser.Input.Pointer;

  // buttons is how many toggle buttons sit to its right
  constructor(scene: Phaser.Scene, buttons = 2) {
    const x = constants.width - constants.toggleButtonMargin - buttons * (size + constants.toggleButtonGap) - width - 8;
    super(scene, x, constants.toggleButtonMargin);
    scene.add.existing(this);
    // Settings remain available above the game-over overlay.
    this.setDepth(150);

    const label = scene.add.text(0, 0, 'Volume', { fontSize: '12px', color: '#cccccc' });
    this.valueText = scene.add.text(width, 0, '', { fontSize: '12px', color: '#cccccc' }).setOrigin(1, 0);
    this.track = scene.add.graphics();
    this.add([label, this.valueText, this.track]);
    // Include the label and space around the knob, so UI taps never start or steer the game.
    this.setInteractive(new Phaser.Geom.Rectangle(-8, -4, width + 16, 40), Phaser.Geom.Rectangle.Contains);
    this.input.cursor = 'pointer';
    this.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.button !== 0) return;
      this.pointer = pointer;
      this.setFromPointer(pointer);
    });
    scene.input.on('pointermove', this.onMove, this);
    scene.input.on('pointerup', this.onUp, this);
    scene.input.on('pointerupoutside', this.onUp, this);
    // Match the existing M/N shortcuts with -/+ for volume.
    scene.input.keyboard.on('keydown-MINUS', this.decrease, this);
    scene.input.keyboard.on('keydown-PLUS', this.increase, this);

    this.once(Phaser.GameObjects.Events.DESTROY, () => {
      scene.input.off('pointermove', this.onMove, this);
      scene.input.off('pointerup', this.onUp, this);
      scene.input.off('pointerupoutside', this.onUp, this);
      scene.input.keyboard.off('keydown-MINUS', this.decrease, this);
      scene.input.keyboard.off('keydown-PLUS', this.increase, this);
    });
    this.redraw();
  }

  private onMove(pointer: Phaser.Input.Pointer): void {
    if (pointer === this.pointer && pointer.isDown) this.setFromPointer(pointer);
  }

  private onUp(pointer: Phaser.Input.Pointer): void {
    if (pointer === this.pointer) this.pointer = undefined;
  }

  private setFromPointer(pointer: Phaser.Input.Pointer): void {
    const world = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
    this.setVolume(Math.round(Phaser.Math.Clamp((world.x - this.x) / width, 0, 1) * 100) / 100);
  }

  private decrease(): void {
    this.setVolume(this.scene.sound.volume - 0.05);
  }

  private increase(): void {
    this.setVolume(this.scene.sound.volume + 0.05);
  }

  private setVolume(volume: number): void {
    setVolume(this.scene, volume);
    this.redraw();
  }

  // for when the volume changed somewhere else
  public redraw(): void {
    const volume = this.scene.sound.volume;
    this.valueText.setText(`${Math.round(volume * 100)}%`);
    this.track.clear();
    this.track.fillStyle(0xffffff, 0.3);
    this.track.fillRoundedRect(0, trackY - 2, width, 4, 2);
    this.track.fillStyle(0x268bd2);
    if (volume > 0) this.track.fillRoundedRect(0, trackY - 2, width * volume, 4, 2);
    this.track.fillStyle(0xffffff, 0.9);
    this.track.fillCircle(width * volume, trackY, 6);
  }
}
