import Phaser from 'phaser';
import BootScene from './BootScene';
import BackgroundScene from './BackgroundScene';
import TitleScene from './TitleScene';
import GameScene from './GameScene';
import PauseScene from './PauseScene';
import { constants } from './constants';
import { preferHighpShaders } from './utils/shader-precision';
import { countOnlyPlayedTime } from './utils/play-clock';
import { followDisplaySize } from './utils/display';

// before the game boots, so it covers every shader Phaser compiles
preferHighpShaders();
countOnlyPlayedTime();

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#060606',
  scale: {
    mode: Phaser.Scale.NONE,
    width: constants.width,
    height: constants.height,
  },
  physics: {
    default: 'arcade',
    arcade: { gravity: { x: 0, y: 0 } },
  },
  input: {
    activePointers: 2,
  },
  callbacks: { postBoot: followDisplaySize },
  // later scenes render on top
  scene: [BootScene, BackgroundScene, TitleScene, GameScene, PauseScene],
};

new Phaser.Game(config);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () {
    navigator.serviceWorker
      .register(new URL("service-worker.ts", import.meta.url), { type: "module" })
      .then((reg) => console.log("ServiceWorker registered:", reg))
      .catch((err) => console.error("ServiceWorker registration failed:", err));
  });
}
