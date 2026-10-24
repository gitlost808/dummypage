import Phaser from 'phaser';
import { constants } from '../constants';

const toHex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

// "WAVE n" (or the boss warning) in the upper middle of the screen: fades in, holds, fades out
export class WaveBanner {
  private scene: Phaser.Scene;
  private text: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.text = scene.add
      .text(constants.width / 2, constants.height * 0.3, '', {
        fontSize: '40px',
        color: toHex(constants.waveBannerColor),
      })
      .setOrigin(0.5)
      .setDepth(50)
      .setAlpha(0);
  }

  public show(wave: number, isBoss: boolean): void {
    this.text
      .setText(isBoss ? constants.bossBannerText : `WAVE ${wave}`)
      .setColor(toHex(isBoss ? constants.bossColor : constants.waveBannerColor));
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
}
