import type Phaser from 'phaser';

// Phaser 4 has no renderer resolution setting. Size its drawing buffer in device
// pixels and use Scale.NONE's zoom to keep the canvas at the parent's CSS size.
export function resizeToDisplay(game: Phaser.Game): void {
  const parent = game.canvas.parentElement;
  if (!parent) return;
  const { width, height } = parent.getBoundingClientRect();
  if (width <= 0 || height <= 0) return;
  const density = window.devicePixelRatio || 1;
  const pixelWidth = Math.round(width * density);
  const pixelHeight = Math.round(height * density);
  if (game.scale.width === pixelWidth && game.scale.height === pixelHeight && game.scale.zoom === 1 / density) return;

  game.scale.resize(pixelWidth, pixelHeight);
  // Set zoom last so Phaser also resets CSS dimensions when returning to 1x.
  game.scale.setZoom(1 / density);
}

export function followDisplaySize(game: Phaser.Game): void {
  const resize = () => resizeToDisplay(game);
  const observer = new ResizeObserver(resize);
  observer.observe(game.canvas.parentElement!);
  window.addEventListener('resize', resize);

  // Moving between monitors can change density without changing the CSS size.
  let densityQuery: MediaQueryList;
  const watchDensity = () => {
    densityQuery?.removeEventListener('change', onDensityChange);
    densityQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    densityQuery.addEventListener('change', onDensityChange);
  };
  const onDensityChange = () => {
    resize();
    watchDensity();
  };
  watchDensity();
  resize();
  game.events.once('destroy', () => {
    observer.disconnect();
    window.removeEventListener('resize', resize);
    densityQuery.removeEventListener('change', onDensityChange);
  });
}
