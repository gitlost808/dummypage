export interface LeaderboardSession {
  session_id: string;
  session_token: string;
  player_name: string;
  started_at: string;
}

export interface RunResult {
  session_id: string;
  player_name: string;
  score: number;
  duration_ms: number;
  started_at: string;
  finished_at: string;
}

export interface LeaderboardEntry extends RunResult {
  rank: number;
}

export class LeaderboardError extends Error {
  readonly status: number;
  // from a 429's Retry-After header
  readonly retryAfterMs?: number;

  constructor(message: string, status = 0, retryAfterMs?: number) {
    super(message);
    this.name = 'LeaderboardError';
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }

  get retryable(): boolean {
    return this.status === 0 || this.status === 429 || this.status >= 500;
  }
}

export function validatePlayerName(value: string): string {
  const name = value.trim();
  if (!name || Array.from(name).length > 32 || /[\u0000-\u001f\u007f-\u009f]/u.test(name)) {
    throw new LeaderboardError('Enter a pilot name of 1–32 characters without control characters.', 400);
  }
  return name;
}

function validateScore(score: number): void {
  if (!Number.isSafeInteger(score) || score < 0) {
    throw new LeaderboardError('The score must be a non-negative integer.', 400);
  }
}

// seconds or an HTTP date
function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  const ms = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(value) - Date.now();
  return Number.isFinite(ms) ? Math.max(0, ms) : undefined;
}

function errorMessage(status: number): string {
  switch (status) {
    case 400: return 'The name or score was not accepted.';
    case 401: return 'This run could not be authenticated.';
    case 404: return 'The leaderboard or run could not be found.';
    case 409: return 'This run already has a different final score.';
    case 422: return 'This run was rejected and doesn’t count on the leaderboard.';
    case 429: return 'Too many requests. Wait a moment and try again.';
    default: return 'The leaderboard is unavailable. Please try again.';
  }
}

export class LeaderboardClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(baseUrl = '', timeoutMs = 8000) {
    this.baseUrl = baseUrl.trim().replace(/\/+$/, '');
    this.timeoutMs = timeoutMs;
  }

  async startRun(playerName: string, signal?: AbortSignal): Promise<LeaderboardSession> {
    const session = await this.request<LeaderboardSession>('/sessions', {
      method: 'POST',
      body: JSON.stringify({ player_name: validatePlayerName(playerName) }),
    }, signal);
    if (!session || typeof session.session_id !== 'string' || !session.session_id ||
        typeof session.session_token !== 'string' || !session.session_token ||
        typeof session.player_name !== 'string') {
      throw new LeaderboardError('The server returned an invalid run. Please try again.');
    }
    return session;
  }

  async checkpoint(session: LeaderboardSession, score: number, signal?: AbortSignal): Promise<void> {
    validateScore(score);
    await this.request<void>(`/sessions/${encodeURIComponent(session.session_id)}/checkpoint`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.session_token}` },
      body: JSON.stringify({ score }),
    }, signal);
  }

  async finishRun(session: LeaderboardSession, score: number, signal?: AbortSignal): Promise<RunResult> {
    validateScore(score);
    const result = await this.request<RunResult>(`/sessions/${encodeURIComponent(session.session_id)}/finish`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.session_token}` },
      body: JSON.stringify({ score }),
    }, signal);
    if (!result || result.session_id !== session.session_id || result.score !== score) {
      throw new LeaderboardError('The server did not confirm this score. Please try again.');
    }
    return result;
  }

  async getLeaderboard(signal?: AbortSignal): Promise<LeaderboardEntry[]> {
    const result = await this.request<{ entries: LeaderboardEntry[] }>('/leaderboard?limit=20', {}, signal);
    if (!result || !Array.isArray(result.entries) || result.entries.some(entry =>
      !entry || typeof entry.session_id !== 'string' || typeof entry.player_name !== 'string' ||
      !Number.isSafeInteger(entry.score) || entry.score < 0 ||
      !Number.isSafeInteger(entry.rank) || entry.rank < 1
    )) {
      throw new LeaderboardError('The server returned an invalid leaderboard. Please try again.');
    }
    return result.entries;
  }

  private async request<T>(path: string, options: RequestInit, signal?: AbortSignal): Promise<T> {
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    const timeout = setTimeout(abort, this.timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl}/api/v1${path}`, {
        ...options,
        headers: {
          Accept: 'application/json',
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
          ...options.headers,
        },
        credentials: 'omit',
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new LeaderboardError(errorMessage(response.status), response.status,
          parseRetryAfter(response.headers.get('Retry-After')));
      }
      // checkpoints answer 204 without a body
      if (response.status === 204) return undefined;
      return await response.json();
    } catch (error) {
      if (error instanceof LeaderboardError) throw error;
      throw new LeaderboardError('Could not reach the leaderboard. Check your connection and try again.');
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
    }
  }
}


function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new LeaderboardError('The request was cancelled.'));
    const onAbort = () => {
      clearTimeout(timer);
      reject(new LeaderboardError('The request was cancelled.'));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export interface RunOptions {
  checkpointIntervalMs?: number;
  // first finish retry; doubles after each failure
  retryDelayMs?: number;
  finishAttempts?: number;
}

// One online run: checkpoints its score so the backend can follow it, then finishes it.
// The backend drops a run that goes quiet for 30s, so checkpoints run on a real timer that keeps
// going while the game is paused, one request at a time.
export class LeaderboardRun {
  // set once the backend has dropped the run (or refused this client); nothing more is sent
  lostError?: LeaderboardError;
  onLost?: (error: LeaderboardError) => void;

  readonly session: LeaderboardSession;
  private readonly client: LeaderboardClient;
  private readonly getScore: () => number;
  private readonly intervalMs: number;
  private readonly retryDelayMs: number;
  private readonly finishAttempts: number;
  private readonly controller = new AbortController();
  private timer?: ReturnType<typeof setInterval>;
  private inFlight?: Promise<void>;
  // the highest score sent in a checkpoint; the final score can't be lower
  private lastScore = 0;
  private finalScore?: number;

  constructor(
    client: LeaderboardClient,
    session: LeaderboardSession,
    getScore: () => number,
    { checkpointIntervalMs = 10_000, retryDelayMs = 1000, finishAttempts = 4 }: RunOptions = {}
  ) {
    this.client = client;
    this.session = session;
    this.getScore = getScore;
    this.intervalMs = checkpointIntervalMs;
    this.retryDelayMs = retryDelayMs;
    this.finishAttempts = finishAttempts;
  }

  start(): void {
    if (this.timer || this.finalScore !== undefined || this.lostError) return;
    this.timer = setInterval(() => this.checkpoint(), this.intervalMs);
  }

  // abandon the run, e.g. when the scene shuts down; the backend expires it on its own
  stop(): void {
    this.stopCheckpoints();
    this.controller.abort();
  }

  // Stops the checkpoints, waits for one still in flight, then submits the final score. Temporary
  // failures are retried with the same score; calling it again after it failed retries too.
  async finish(score: number, signal?: AbortSignal): Promise<RunResult> {
    validateScore(score);
    if (this.finalScore !== undefined && score !== this.finalScore) {
      throw new LeaderboardError(errorMessage(409), 409);
    }
    this.stopCheckpoints();
    await this.inFlight;
    if (this.lostError) throw this.lostError;
    if (score < this.lastScore) throw new LeaderboardError(errorMessage(400), 400);
    this.finalScore = score;
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.client.finishRun(this.session, score, signal);
      } catch (error) {
        if (signal?.aborted || !(error instanceof LeaderboardError) || !error.retryable ||
            attempt >= this.finishAttempts) {
          if (error instanceof LeaderboardError) this.handleFatal(error);
          throw error;
        }
        await sleep(error.retryAfterMs ?? this.retryDelayMs * 2 ** (attempt - 1), signal);
      }
    }
  }

  private stopCheckpoints(): void {
    clearInterval(this.timer);
    this.timer = undefined;
  }

  private checkpoint(): void {
    // never overlap: a slow request just skips this tick
    if (this.inFlight || !this.timer) return;
    // the backend rejects a score that goes down; count it once sent, as the backend may have it
    // even if the response is lost
    const score = this.lastScore = Math.max(this.getScore(), this.lastScore);
    this.inFlight = this.client.checkpoint(this.session, score, this.controller.signal)
      .catch(error => {
        if (this.controller.signal.aborted || !(error instanceof LeaderboardError)) return;
        // the next tick retries temporary failures
        if (error.retryable) return;
        // already finished: nothing left to follow
        if (error.status === 409) return this.stopCheckpoints();
        this.handleFatal(error);
      })
      .finally(() => { this.inFlight = undefined; });
  }

  // 422: rejected and deleted, 404: gone, 401: bad token
  private handleFatal(error: LeaderboardError): void {
    if (this.lostError || ![401, 404, 422].includes(error.status)) return;
    this.lostError = error;
    this.stop();
    this.onLost?.(error);
  }
}
