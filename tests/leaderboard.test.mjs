import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  LeaderboardClient,
  LeaderboardError,
  validatePlayerName,
} from '../src/game/leaderboard/client.ts';

const session = {
  session_id: 'e75be306-fdb1-44d2-9dd7-e2d2beeb3e76',
  session_token: 'private-run-token',
  player_name: 'Pilot',
  started_at: '2026-10-30T10:00:00Z',
  expires_at: '2026-10-30T11:00:00Z',
};
const result = {
  session_id: session.session_id,
  player_name: session.player_name,
  score: 1000,
  duration_ms: 60000,
  started_at: session.started_at,
  finished_at: '2026-10-30T10:01:00Z',
};
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json' },
});

test('runs use the configured backend, exact payloads, and per-run token', async t => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/sessions')) return json(session, 201);
    if (url.endsWith('/finish')) return json(result);
    return json({ entries: [{ ...result, rank: 1 }] });
  });
  const client = new LeaderboardClient('https://scores.example.com///');
  const run = await client.startRun('  Pilot  ');
  assert.deepEqual(run, session);
  assert.deepEqual(await client.finishRun(run, 1000), result);
  // A retry sends the same result and credentials; the backend owns idempotency.
  await client.finishRun(run, 1000);
  const entries = await new LeaderboardClient('https://scores.example.com').getLeaderboard();
  assert.equal(entries[0].score, 1000);
  assert.equal(entries[0].rank, 1);
  assert.equal(calls[0].url, 'https://scores.example.com/api/v1/sessions');
  assert.deepEqual(JSON.parse(calls[0].options.body), { player_name: 'Pilot' });
  assert.equal(calls[0].options.headers.Authorization, undefined);
  assert.equal(calls[1].url, `https://scores.example.com/api/v1/sessions/${session.session_id}/finish`);
  assert.equal(calls[1].options.headers.Authorization, `Bearer ${session.session_token}`);
  assert.deepEqual(JSON.parse(calls[1].options.body), { score: 1000 });
  assert.equal(calls[2].options.body, calls[1].options.body);
  assert.equal(calls[2].options.headers.Authorization, calls[1].options.headers.Authorization);
  assert.equal(calls[3].url, 'https://scores.example.com/api/v1/leaderboard?limit=20');
  assert.equal(calls[3].options.headers.Authorization, undefined);
  assert.equal(calls[3].options.headers['Content-Type'], undefined);
  for (const { options } of calls) {
    assert.equal(options.cache, 'no-store');
    assert.equal(options.credentials, 'omit');
  }
});

test('empty configuration uses the frontend origin and supports an empty leaderboard', async t => {
  t.mock.method(globalThis, 'fetch', async url => {
    assert.equal(url, '/api/v1/leaderboard?limit=20');
    return json({ entries: [] });
  });
  assert.deepEqual(await new LeaderboardClient('').getLeaderboard(), []);
});

test('names follow the backend Unicode length and control-character rules', () => {
  assert.equal(validatePlayerName('  Ada Lovelace  '), 'Ada Lovelace');
  assert.equal(validatePlayerName('🚀'.repeat(32)), '🚀'.repeat(32));
  for (const name of ['', '   ', '🚀'.repeat(33), 'Pilot\u0000', 'Pi\tlot', 'Pi\u0085lot']) {
    assert.throws(() => validatePlayerName(name), LeaderboardError);
  }
});

test('invalid names and scores are rejected before a request is sent', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('Unexpected request');
  });
  const client = new LeaderboardClient('');
  await assert.rejects(client.startRun(''), LeaderboardError);
  for (const score of [-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    await assert.rejects(client.finishRun(session, score), LeaderboardError);
  }
  assert.equal(fetch.mock.callCount(), 0);
});

test('a zero score is submitted and confirmed', async t => {
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    assert.deepEqual(JSON.parse(options.body), { score: 0 });
    return json({ ...result, score: 0 });
  });
  assert.equal((await new LeaderboardClient('').finishRun(session, 0)).score, 0);
});

test('HTTP failures distinguish temporary failures from rejected runs', async t => {
  for (const status of [400, 401, 404, 409, 410, 422, 429, 500, 503]) {
    await t.test(String(status), async t => {
      t.mock.method(globalThis, 'fetch', async () => json({ error: 'server detail' }, status));
      await assert.rejects(new LeaderboardClient('').finishRun(session, 1000), error => {
        assert.ok(error instanceof LeaderboardError);
        assert.equal(error.status, status);
        assert.equal(error.retryable, status === 429 || status >= 500);
        assert.ok(error.message.length > 0);
        return true;
      });
    });
  }
});

test('network failures produce a retryable error', async t => {
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('Failed to fetch'); });
  await assert.rejects(new LeaderboardClient('').getLeaderboard(), error => {
    assert.ok(error instanceof LeaderboardError);
    assert.equal(error.retryable, true);
    return true;
  });
});

test('requests time out instead of blocking the game indefinitely', async t => {
  t.mock.method(globalThis, 'fetch', (_url, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
  }));
  await assert.rejects(new LeaderboardClient('', 10).startRun('Pilot'), LeaderboardError);
});

test('closing a screen aborts its in-flight request', async t => {
  let requestSignal;
  t.mock.method(globalThis, 'fetch', (_url, { signal }) => new Promise((resolve, reject) => {
    requestSignal = signal;
    signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
  }));
  const controller = new AbortController();
  const pending = new LeaderboardClient('').getLeaderboard(controller.signal);
  controller.abort();
  await assert.rejects(pending, LeaderboardError);
  assert.equal(requestSignal.aborted, true);
});

test('malformed backend responses are not reported as successful saves or scores', async t => {
  const scenarios = [
    { body: {}, call: client => client.startRun('Pilot') },
    { body: { ...session, session_token: '' }, call: client => client.startRun('Pilot') },
    { body: { ...result, score: 999 }, call: client => client.finishRun(session, 1000) },
    { body: null, call: client => client.getLeaderboard() },
    { body: { entries: null }, call: client => client.getLeaderboard() },
    { body: { entries: [{ ...result, rank: 0 }] }, call: client => client.getLeaderboard() },
    { body: { entries: [{ ...result, rank: 1, score: -1 }] }, call: client => client.getLeaderboard() },
  ];
  for (const [index, { body, call }] of scenarios.entries()) {
    await t.test(String(index), async t => {
      t.mock.method(globalThis, 'fetch', async () => json(body));
      await assert.rejects(call(new LeaderboardClient('')), LeaderboardError);
    });
  }
});
