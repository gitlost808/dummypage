export interface LeaderboardSession {
  session_id: string;
  session_token: string;
  player_name: string;
  started_at: string;
  expires_at: string;
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

  constructor(message: string, status = 0) {
    super(message);
    this.name = 'LeaderboardError';
    this.status = status;
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

function errorMessage(status: number): string {
  switch (status) {
    case 400: return 'The name or score was not accepted.';
    case 401: return 'This run could not be authenticated.';
    case 404: return 'The leaderboard or run could not be found.';
    case 409: return 'This run already has a different final score.';
    case 410: return 'This run expired before its score could be saved.';
    case 422: return 'This run did not meet the server’s duration or score limits.';
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

  async finishRun(session: LeaderboardSession, score: number, signal?: AbortSignal): Promise<RunResult> {
    if (!Number.isSafeInteger(score) || score < 0) {
      throw new LeaderboardError('The score must be a non-negative integer.', 400);
    }
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
      if (!response.ok) throw new LeaderboardError(errorMessage(response.status), response.status);
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

