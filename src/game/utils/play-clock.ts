import Phaser from 'phaser';

// Phaser sets each scene's clock to the browser's frame timestamp, which keeps counting while the tab
// is hidden or the scene is paused. Spawns, difficulty, power-ups and cooldowns are all scheduled
// against time.now, so a phone coming back from the background found minutes of play gone at once:
// the difficulty maxed out and an armada spawned. Advance the clock by the frame's delta instead,
// which Phaser caps and resets after the tab was hidden, so time away from the game never counts.
export function countOnlyPlayedTime(): void {
  const update = Phaser.Time.Clock.prototype.update;
  Phaser.Time.Clock.prototype.update = function (this: Phaser.Time.Clock, _time: number, delta: number) {
    update.call(this, this.now + delta, delta);
  };
}
