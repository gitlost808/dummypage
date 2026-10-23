export const constants = {
  width: 800,
  height: 600,
  playerSpeed: 300,
  playerDrag: 600,
  projectileSpeed: 500,
  enemyProjectileSpeed: 260,
  enemyProjectileColor: 0xff6b6b,
  maxProjectiles: 50,
  playerColor: 0x859900,
  enemyColor: 0xff0000,
  projectileColor: 0xffffff,
  // background: a tileable Perlin-noise nebula with parallax star layers on top
  nebulaTextureSize: 256,
  // the texture is upscaled for large, soft clouds
  nebulaTileScale: 4,
  nebulaBasePeriod: 3,
  nebulaOctaves: 5,
  // noise density below this (0..1) is empty space
  nebulaCoverage: 0.45,
  nebulaMaxAlpha: 0.5,
  nebulaColors: [0x268bd2, 0x6c71c4] as [number, number],
  // scroll speeds are in pixels/sec
  nebulaScrollSpeed: 6,
  starTileSize: 256,
  // far to near: nearer stars are brighter, bigger and faster
  starLayers: [
    { count: 140, size: 1, color: 0x505050, speed: 12 },
    { count: 50, size: 1, color: 0x909090, speed: 30 },
    { count: 14, size: 2, color: 0xd0d0d0, speed: 60 },
  ],
  maxEnemies: 50,
  scorePerTier: 100,
  // difficulty progression: every N points or ~60s elapsed
  difficultyTimeStepMs: 60000,
  maxDifficultyTier: 6,
  baseInterval: 2000,
  intervalDecrement: 300,
  minInterval: 500,
  enemySpawnMargin: 50,
  enemyBaseSpeed: 100,
  enemySpeedIncrement: 50,
  enemyFireStartTier: 1,
  enemyFireIntervalBase: 1600,
  enemyFireIntervalDecrement: 120,
  enemyFireIntervalMin: 650,
  enemyTrackStrengthBase: 0.75,
  enemyTrackStrengthIncrement: 0.05,
  enemySwayAmplitudeBase: 40,
  enemySwayAmplitudeIncrement: 8,
  enemySwayFrequencyBase: 0.002,
  enemySwayFrequencyIncrement: 0.0004,
  enemyDiveChanceBase: 0.1, // per second
  enemyDiveChanceIncrement: 0.05,
  enemyDiveSpeedMultiplier: 1.6,
  enemyDiveDurationMin: 400,
  enemyDiveDurationMax: 900,
  pointsPerHit: 10,
  // how often an enemy will start an evasion (in ms)
  evasionIntervalMin: 800,
  evasionIntervalMax: 2500,
  // how long each evasion lasts (in ms)
  evasionDurationMin: 300,
  evasionDurationMax: 800,
  // how fast they dodge laterally (pixels/sec)
  evasionSpeed: 200,
  bottomMargin: 200,
  // horizontal joystick offset (px) before touch movement registers
  touchDeadZone: 12,
  // power-ups: dropped by destroyed enemies
  powerUpDropChance: 0.12,
  powerUpSpeed: 120,
  powerUpWeights: { shield: 0.45, spread: 0.4, bomb: 0.15 },
  shieldColor: 0x2aa198,
  spreadColor: 0x268bd2,
  bombColor: 0xcb4b16,
  // brief invulnerability after the shield absorbs a hit (in ms)
  shieldInvulnerabilityMs: 1000,
  spreadDurationMs: 8000,
  // horizontal speed of the outer spread projectiles (pixels/sec)
  spreadVelocityX: 150,
  // explosions: particle bursts on kills and shield hits
  explosionParticles: 14,
  explosionSmallParticles: 6,
  explosionSpeedMin: 60,
  explosionSpeedMax: 200,
  explosionLifespanMin: 300,
  explosionLifespanMax: 500,
  // camera shake when ramming with the shield / detonating a bomb (duration ms, intensity)
  shieldHitShakeMs: 100,
  shieldHitShakeIntensity: 0.005,
  bombShakeMs: 300,
  bombShakeIntensity: 0.012,
  explosionDeathParticles: 30,
  deathShakeMs: 250,
  deathShakeIntensity: 0.01,
  // game-over screen
  gameOverColor: 0xdc322f,
  gameOverBackdropAlpha: 0.6,
  // ignore restart input for this long after dying (in ms)
  gameOverInputDelayMs: 600,
  // minimum time between volleys while fire is held (in ms)
  fireCooldownMs: 180,
  // tank: slow, takes several hits
  tankColor: 0xb58900,
  tankHp: 3,
  tankPoints: 30,
  tankSpeedMultiplier: 0.6,
  // gunner: fires aimed shots at the player
  gunnerColor: 0xd33682,
  gunnerPoints: 20,
  gunnerProjectileSpeed: 220,
  gunnerFireIntervalMultiplier: 1.25,
  // random aim offset (radians)
  gunnerAimJitter: 0.08,
  // minimum angle below horizontal for aimed shots (radians), so they always head down
  gunnerMinAimAngle: 0.35,
  // white flash and spark burst when an enemy survives a hit
  enemyHitFlashMs: 60,
  enemyHitSparkParticles: 4,
  // sound: master volume, and the minimum gap before the same sound plays again
  soundVolume: 0.8,
  soundMinIntervalMs: 40,
  // random pitch variation for frequent sounds (cents)
  soundDetuneCents: 80,
  muteButtonMargin: 10,
  // ship FX (WebGL only): a soft neon glow in the ship's color, plus motion blur on the player
  shipGlowStrength: 3,
  // extra pixels around the sprite so the glow isn't clipped at the texture edge
  shipFxPadding: 8,
  // horizontal blur offset at full player speed
  playerMotionBlur: 2,
};
