# Galactic Skirmish

## A vibe coding game.

I've created this tiny game as an experiment on how far vibe coding has come. And I have to say, it's pretty incredible!

## Persistent leaderboard

The game uses [spacegame-backend](https://github.com/gitlost808/spacegame-backend)
for shared scores. Before each run, choose a pilot name (1–32 characters); the
browser remembers it for next time. A session is created before gameplay starts,
and game over submits the final score with that run's private token. Tokens stay
in memory. The existing personal high score remains in browser storage.

Open **LEADERBOARD** on the title or game-over screen, or press **L**, to see the
top 20 runs. The current run is highlighted if it appears in the results. Failed
score submissions can be retried from game over when the failure is temporary.
Retries send the same score and token and are idempotent on the backend. Starting
another run or reloading discards an unsaved submission. **Play offline** skips
the backend and keeps the personal high score on this device.

### Local setup

1. Follow the backend's README to start PostgreSQL, apply migrations, and run the
   API (port 8080 by default).
2. Set `leaderboardApiUrl` in `src/game/constants.ts` to the backend base URL,
   without `/api/v1` (for example, `http://localhost:8080`).
3. Set the backend's `CORS_ALLOWED_ORIGINS` to the exact frontend origin. Parcel
   uses `http://localhost:1234` by default; the backend example uses port 5173,
   so update it for this project. Restart the backend after changing it.
4. Run `npm start` and open `/game/`.

### Hosting

`leaderboardApiUrl` in `src/game/constants.ts` is set to
`https://spacegame.0x29a.me`. Build and deploy the repository as usual. The URL is
part of the source; no frontend environment configuration is required. Allow
the frontend's HTTPS origin in the backend's CORS configuration. Rebuild after
changing the constant.

With `leaderboardApiUrl: ''`, requests use `/api/v1` on the current origin.
Configure your reverse proxy to forward that path to the backend. Static hosting
alone does not provide persistence; the backend and its PostgreSQL database must
be running. The PWA does not cache API requests.

The backend ranks individual runs; a pilot name can occur more than once. Names
are display names, not authenticated accounts.

### Score validation

The frontend follows the backend's session contract: create a named session
before gameplay, then submit only `{ "score": <integer> }` with that session's
Bearer token at game over. The backend calculates duration from its own start
and finish timestamps and checks:

```text
0 <= score <= elapsed_seconds * MAX_SCORE_PER_SECOND
```

For the current game tuning and the backend's existing one-hour session limit,
use these as conservative initial settings in the **backend deployment
configuration**:

```dotenv
SESSION_MIN_DURATION=1s
SESSION_MAX_DURATION=1h
MAX_SCORE_PER_SECOND=300
```

The backend defaults to 1000 points per second; 300 is a tighter suggested
ceiling, not a change to the backend repository. It is a whole-run average, not
a limit on the points awarded during any single second. Boss kills and bombs
can award many points at once.

The estimate comes from the current scoring and spawning rules:

- Survival awards 1 point per active second.
- Normal enemies, gunners, and tanks award 10, 20, and 30 points, respectively:
  all give 10 points per unit of spawn threat. Bombs and lasers award those same
  kill points.
- Threat accrues at up to 3.5 units per second, with overtime multiplying it by
  `1 + max(0, non_boss_seconds - 240) / 600`.
- Boss encounter `n` awards `500 * n`. Each encounter needs four regular waves
  first, taking at least `4 * (20 + 3.5) = 94` seconds, even ignoring the boss
  fight and the following break.

If every enemy were killed, maximum difficulty applied from the start, regular
spawns continued during all breaks and boss fights, and bosses died instantly,
these relaxed bounds give roughly 455,304 enemy points, 370,500 boss points,
and 3,600 survival points in an hour: about 230 points per second averaged over
the run. The suggested 300 leaves headroom above that deliberately generous
estimate. Recalculate when changing scoring, spawn budgets, waves, or the maximum
session duration; overtime and escalating boss rewards make a fixed ceiling
increasingly permissive early and potentially too restrictive for longer runs.

**Elapsed session time is not active play time.** Server duration includes
pauses, time in the background, and delays before a successful finish request.
The frontend's game clock excludes paused/background time. A one-hour session
also expires after one hour of wall time, including pauses. These settings reject
implausibly fast scores but cannot establish that someone actually played for
that duration. A stricter active-play policy needs a backend protocol change;
simply accepting a client-supplied duration does not make it authoritative.

### Checks

Run `npm run typecheck`, `npm run test:leaderboard`, and `npm run build`. The API
client tests use Node's built-in test runner and TypeScript support (Node 22.18+
or 24+). They mock HTTP responses, so a running backend is not required.
