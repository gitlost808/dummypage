export const constants = {
  // the playfield: a fixed size, scaled to fit the window, so the game plays the same on every screen
  width: 540,
  height: 960,
  // faint lines along the sides of the playfield, so it's clear where it ends on wide screens
  playfieldBorderColor: 0x268bd2,
  playfieldBorderAlpha: 0.35,
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
  // waves: spawning runs for waveDurationMs, then pauses for waveBreakMs so the screen can clear
  waveDurationMs: 20000,
  waveBreakMs: 3500,
  waveBannerColor: 0x268bd2,
  // banner fade in, hold and fade out (in ms)
  waveBannerFadeMs: 250,
  waveBannerHoldMs: 1000,
  // spawn weights, from the difficulty each one unlocks at: [weight when unlocked, weight at difficulty 1]
  enemyKindWeights: {
    normal: { unlockAt: 0, weight: [1, 1] as [number, number] },
    tank: { unlockAt: 0.3, weight: [0.15, 0.4] as [number, number] },
    gunner: { unlockAt: 0.45, weight: [0.15, 0.35] as [number, number] },
  },
  // movement of normal enemies; tanks fall straight and gunners hover
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
  // ship travel per pixel of finger travel (both in playfield px)
  touchDragSensitivity: 1,
  // top speed of the ship gliding after the finger (pixels/sec), so fast flicks don't teleport it
  touchFollowMaxSpeed: 1500,
  // power-ups: dropped by destroyed enemies
  powerUpDropChance: 0.12,
  powerUpSpeed: 120,
  powerUpWeights: { shield: 0.45, spread: 0.4, bomb: 0.15 },
  shieldColor: 0x2aa198,
  spreadColor: 0x268bd2,
  bombColor: 0xcb4b16,
  // shields stack up to this many layers, drawn as rings around the ship (radii in px)
  shieldMaxLayers: 3,
  shieldRadius: 24,
  shieldLayerGap: 6,
  // each layer held makes a shield drop this much likelier to be skipped (1/3: 1 in 3 at one layer, none at three)
  shieldDropFalloffPerLayer: 1 / 3,
  // brief invulnerability after a shield layer absorbs a hit (in ms)
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
  // a hit knocks a tank back: its fall speed drops by this multiple of itself, then recovers.
  // Without it, a tank close to the player lands on it before the third hit, so it can't be shot down
  tankRecoil: 1.5,
  // gunner: fires aimed shots at the player
  gunnerColor: 0xd33682,
  gunnerPoints: 20,
  gunnerProjectileSpeed: 220,
  gunnerFireIntervalMultiplier: 1.25,
  // random aim offset (radians)
  gunnerAimJitter: 0.08,
  // minimum angle below horizontal for aimed shots (radians), so they always head down
  gunnerMinAimAngle: 0.35,
  // gunners stop at a height in this band (fraction of screen height), patrol and fire, then retreat upwards
  gunnerHoverYMin: 0.12,
  gunnerHoverYMax: 0.3,
  gunnerHoverMsMin: 4000,
  gunnerHoverMsMax: 7000,
  // patrol: sway this fraction of the screen width either side of the centre
  gunnerPatrolSpread: 0.35,
  // radians per ms, about one sweep every 8 seconds
  gunnerPatrolFrequency: 0.0008,
  // boss: every bossEveryWaves-th wave is the boss alone; the wave lasts until it's beaten,
  // and the difficulty clock stands still meanwhile
  bossEveryWaves: 5,
  bossColor: 0x6c71c4,
  bossProjectileColor: 0xb4a7ff,
  bossBannerText: 'WARNING: BOSS',
  // hit points and points at the first encounter; each later encounter adds the growth fraction of the base
  bossHp: 80,
  bossHpGrowth: 0.5,
  bossPoints: 500,
  // later encounters also attack more often (cooldowns shrink by 1 + growth per encounter)
  bossAttackRateGrowth: 0.15,
  // slides in from the top to this height (fraction of screen height), then patrols like a gunner
  bossEntrySpeed: 70,
  bossHoverY: 0.18,
  bossPatrolSpread: 0.3,
  bossPatrolFrequency: 0.0006,
  bossLateralSpeed: 140,
  // phases start below these fractions of hit points
  bossPhaseThresholds: [0.66, 0.33],
  // per phase: the attacks it picks from, the pause after each attack (ms) and the patrol speed-up
  bossPhases: [
    { attacks: ['burst', 'fan'], cooldownMs: 1500, burstShots: 3, fanShots: 5, patrolSpeed: 1 },
    { attacks: ['burst', 'fan'], cooldownMs: 1150, burstShots: 5, fanShots: 7, patrolSpeed: 1.4 },
    { attacks: ['burst', 'fan', 'ring'], cooldownMs: 950, burstShots: 5, fanShots: 7, patrolSpeed: 1.8 },
  ] as { attacks: ('burst' | 'fan' | 'ring')[]; cooldownMs: number; burstShots: number; fanShots: number; patrolSpeed: number }[],
  // the boss blinks before each attack, so it can be read and dodged
  bossTelegraphMs: 450,
  bossFirstAttackDelayMs: 800,
  bossProjectileSpeed: 210,
  bossBurstGapMs: 110,
  // total angle of the fan (radians), aimed at the player
  bossFanArc: 1.1,
  bossRingShots: 16,
  bossRingSpeed: 150,
  // a bomb takes this fraction of the boss's hit points
  bossBombDamage: 0.15,
  // death: a chain of explosions over the hull
  bossDeathExplosions: 6,
  bossDeathExplosionGapMs: 120,
  bossHealthBarY: 108,
  bossHealthBarHeight: 8,
  // enemy bullets get their own, larger pool, since boss attacks fire many at once
  maxEnemyProjectiles: 150,
  // basic enemies drift sideways at up to this speed (pixels/sec) and bounce off the edges
  enemyDriftSpeed: 60,
  // white flash and spark burst when an enemy survives a hit
  enemyHitFlashMs: 60,
  enemyHitSparkParticles: 4,
  // sound: master volume, and the minimum gap before the same sound plays again
  soundVolume: 0.8,
  soundMinIntervalMs: 40,
  // random pitch variation for frequent sounds (cents)
  soundDetuneCents: 80,
  // background music sits under the sound effects
  musicVolume: 0.5,
  // switching tracks (boss wave, boss defeated) and game over: the old track slows to this rate as it fades
  musicTransitionMs: 1200,
  musicWindDownRate: 0.5,
  // the sound and music buttons in the top-right corner
  toggleButtonMargin: 10,
  toggleButtonGap: 12,
  // ship FX (WebGL only): a soft neon glow in the ship's color, plus motion blur on the player
  shipGlowStrength: 3,
  // multiplies the glow's reach; it's measured in texture pixels, so it shrinks with the camera zoom
  shipGlowScale: 4,
  // horizontal blur offset at full player speed
  playerMotionBlur: 2,
};
