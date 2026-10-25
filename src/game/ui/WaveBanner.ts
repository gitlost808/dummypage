import Phaser from 'phaser';
import { constants } from '../constants';

const toHex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

// "WAVE n" (or the boss warning) in the upper middle of the screen: fades in, holds, fades out.
// A threat unlocked by the last boss gets a line underneath, and a longer hold so it can be read
export class WaveBanner {
  private scene: Phaser.Scene;
  private text: Phaser.GameObjects.Text;
  private escalationText: Phaser.GameObjects.Text;

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
    this.escalationText = scene.add
      .text(constants.width / 2, constants.height * 0.3 + 44, '', {
        fontSize: '22px',
        color: toHex(constants.escalationBannerColor),
      })
      .setOrigin(0.5)
      .setDepth(50)
      .setAlpha(0);
  }

  public show(wave: number, isBoss: boolean, escalation?: string): void {
    this.text
      .setText(isBoss ? constants.bossBannerText : `WAVE ${wave}`)
      .setColor(toHex(isBoss ? constants.bossColor : constants.waveBannerColor));
    this.escalationText.setText(escalation ?? '');
    const targets = [this.text, this.escalationText];
    this.scene.tweens.killTweensOf(targets);
    for (const target of targets) target.setAlpha(0);
    this.scene.tweens.chain({
      targets,
      tweens: [
        { alpha: 1, duration: constants.waveBannerFadeMs },
        {
          alpha: 0,
          duration: constants.waveBannerFadeMs * 2,
          delay: escalation ? constants.escalationBannerHoldMs : constants.waveBannerHoldMs,
        },
      ],
    });
  }
}
