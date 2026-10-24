import Phaser from 'phaser';
import { constants } from '../constants';

const toHex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

// "WAVE n" in the upper middle of the screen: fades in, holds, fades out
export class WaveBanner {
  private scene: Phaser.Scene;
  private text: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.text = scene.add
      .text(0, 0, '', {
        fontSize: '40px',
        color: toHex(constants.waveBannerColor),
      })
      .setOrigin(0.5)
      .setDepth(50)
      .setAlpha(0);
    this.layout(scene.scale.width, scene.scale.height);
  }

  public show(wave: number): void {
    this.text.setText(`WAVE ${wave}`);
    this.scene.tweens.killTweensOf(this.text);
    this.text.setAlpha(0);
    this.scene.tweens.chain({
      targets: this.text,
      tweens: [
        { alpha: 1, duration: constants.waveBannerFadeMs },
        { alpha: 0, duration: constants.waveBannerFadeMs * 2, delay: constants.waveBannerHoldMs },
      ],
    });
  }

  public layout(width: number, height: number): void {
    this.text.setPosition(width / 2, height * 0.3);
  }
}
