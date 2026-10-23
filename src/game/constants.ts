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
  // difficulty: a value in 0..1 from time survived, 1 - exp(-t / ramp), so it climbs quickly at first
  // and levels off (~0.45 at 1 min, ~0.83 at 3 min, ~0.95 at 5 min)
  difficultyRampMs: 100000,
  // after the curve levels off, spawn budget and on-screen cap keep growing (+100% per overtimeMs), so long runs never plateau
  overtimeStartMs: 240000,
  overtimeMs: 600000,
  // the [easy, hard] ranges below are interpolated by difficulty
  // threat budget: every enemy costs threat; budget builds up over time and pays for spawns
  enemyThreatCost: { normal: 1, gunner: 2, tank: 3 },
  threatPerSecond: [0.5, 3.5] as [number, number],
  // spawns wait while the enemies on screen add up to this much threat
  maxThreatOnScreen: [4, 14] as [number, number],
  // unspent budget is capped (at least the priciest enemy), so a quiet moment doesn't turn into a burst
  maxBankedThreat: 4,
  spawnTickMs: 100,
  minSpawnGapMs: 250,
  // spawn weights, from the difficulty each one unlocks at: [weight when unlocked, weight at difficulty 1]
  enemyKindWeights: {
    normal: { unlockAt: 0, weight: [1, 1] as [number, number] },
    tank: { unlockAt: 0.3, weight: [0.15, 0.4] as [number, number] },
    gunner: { unlockAt: 0.45, weight: [0.15, 0.35] as [number, number] },
  },
  enemyBehaviorWeights: {
    basic: { unlockAt: 0, weight: [1, 0.15] as [number, number] },
    strafer: { unlockAt: 0.1, weight: [1, 0.8] as [number, number] },
    diver: { unlockAt: 0.35, weight: [0.3, 1] as [number, number] },
  },
  enemySpawnMargin: 50,
  enemySpeed: [100, 340] as [number, number],
  // sideways tracking speed, still capped by enemyMaxLateralSpeedRatio
  enemyLateralSpeed: [70, 230] as [number, number],
  // enemies hold fire for the first few seconds
  enemyFireStartDifficulty: 0.05,
  enemyFireIntervalMs: [1600, 750] as [number, number],
  enemySwayAmplitude: [40, 90] as [number, number],
  enemySwayFrequency: [0.002, 0.0045] as [number, number],
  // shortens the time between evasions and the evasions themselves
  enemyEvasionScale: [1, 1.9] as [number, number],
  // per second
  enemyDiveChance: [0.1, 0.4] as [number, number],
  enemyDiveSpeedMultiplier: 1.6,
  enemyDiveDurationMin: 400,
  enemyDiveDurationMax: 900,
  // divers hang and blink before diving, then commit to a fixed direction (in ms)
  enemyDiveWindupMs: 400,
  enemyDiveWindupSpeedFactor: 0.2,
  enemyDiveBlinkMs: 70,
  // minimum dive angle below horizontal (radians), and how far above the player a dive can start (px)
  enemyDiveMinAngle: 0.5,
  enemyDiveMinHeight: 120,
  // steering: how quickly enemies reach their desired sideways velocity (per second)
  enemySteerRate: 5,
  // desired sideways speed per pixel of distance to the target x, so enemies ease in instead of jittering
  enemyTrackGain: 2,
  // sideways speed cap as a fraction of the player's speed, so the player can always outrun them
  enemyMaxLateralSpeedRatio: 0.8,
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
