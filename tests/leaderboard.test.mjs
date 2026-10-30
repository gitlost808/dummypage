import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  LeaderboardClient,
  LeaderboardError,
  LeaderboardRun,
  PlayerNameError,
  validatePlayerName,
} from '../src/game/leaderboard/client.ts';

const session = {
  session_id: 'e75be306-fdb1-44d2-9dd7-e2d2beeb3e76',
  session_token: 'private-run-token',
  player_name: 'Pilot',
  started_at: '2026-10-30T10:00:00Z',
};
const result = {
  session_id: session.session_id,
  player_name: session.player_name,
  score: 1000,
  duration_ms: 60000,
  started_at: session.started_at,
  finished_at: '2026-10-30T10:01:00Z',
};
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json', ...headers },
});
const noContent = () => new Response(null, { status: 204 });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const fast = { checkpointIntervalMs: 20, retryDelayMs: 1 };

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
    assert.throws(() => validatePlayerName(name), PlayerNameError);
  }
});

test('names the backend refuses are reported as name rejections, not retryable failures', async t => {
  for (const status of [400, 422]) {
    await t.test(String(status), async t => {
      t.mock.method(globalThis, 'fetch', async () => json({ error: 'player_name is not allowed' }, status));
      await assert.rejects(new LeaderboardClient('').startRun('Pilot'), error => {
        assert.ok(error instanceof PlayerNameError);
        assert.ok(error instanceof LeaderboardError);
        assert.equal(error.status, status);
        assert.equal(error.retryable, false);
        // Server details are untrusted and not shown; the client supplies its own message.
        assert.doesNotMatch(error.message, /not allowed/);
        return true;
      });
    });
  }
});

test('other run start failures and rejected scores are not name rejections', async t => {
  for (const status of [429, 503]) {
    await t.test(`start ${status}`, async t => {
      t.mock.method(globalThis, 'fetch', async () => json({ error: 'server detail' }, status));
      await assert.rejects(new LeaderboardClient('').startRun('Pilot'), error => {
        assert.ok(error instanceof LeaderboardError);
        assert.ok(!(error instanceof PlayerNameError));
        assert.equal(error.retryable, true);
        return true;
      });
    });
  }
  for (const status of [400, 422]) {
    await t.test(`finish ${status}`, async t => {
      t.mock.method(globalThis, 'fetch', async () => json({ error: 'server detail' }, status));
      await assert.rejects(new LeaderboardClient('').finishRun(session, 1000), error => {
        assert.ok(!(error instanceof PlayerNameError));
        return true;
      });
    });
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
  for (const status of [400, 401, 404, 409, 422, 429, 500, 503]) {
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

test('checkpoints send the running score with the run token and accept an empty 204', async t => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, options });
    return noContent();
  });
  assert.equal(await new LeaderboardClient('https://scores.example.com').checkpoint(session, 42), undefined);
  assert.equal(calls[0].url, `https://scores.example.com/api/v1/sessions/${session.session_id}/checkpoint`);
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.headers.Authorization, `Bearer ${session.session_token}`);
  assert.deepEqual(JSON.parse(calls[0].options.body), { score: 42 });
  await assert.rejects(new LeaderboardClient('').checkpoint(session, -1), LeaderboardError);
  assert.equal(calls.length, 1);
});

test('Retry-After is read from 429 responses', async t => {
  t.mock.method(globalThis, 'fetch', async () => json({ error: 'slow down' }, 429, { 'Retry-After': '3' }));
  await assert.rejects(new LeaderboardClient('').checkpoint(session, 1), error => {
    assert.equal(error.retryAfterMs, 3000);
    return true;
  });
});

test('a run checkpoints on a timer, one request at a time, then finishes after the last one lands', async t => {
  const log = [];
  let open = 0;
  let score = 5;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    const kind = url.split('/').pop();
    const body = JSON.parse(options.body);
    log.push(`${kind}:${body.score}`);
    assert.equal(open++, 0, 'requests must not overlap');
    // slower than the interval, so ticks land while a checkpoint is in flight
    await delay(30);
    open--;
    log.push(`${kind} done`);
    return kind === 'finish' ? json({ ...result, score: body.score }) : noContent();
  });
  const run = new LeaderboardRun(new LeaderboardClient(''), session, () => score++, fast);
  run.start();
  await delay(100);
  const finished = await run.finish(100);
  assert.equal(finished.score, 100);
  const finishAt = log.indexOf('finish:100');
  assert.ok(finishAt > 0);
  // finish waited for the checkpoint it interrupted, and nothing followed it
  assert.equal(log[finishAt - 1], 'checkpoint done');
  assert.deepEqual(log.slice(finishAt), ['finish:100', 'finish done']);
  const scores = log.filter(entry => entry.startsWith('checkpoint:')).map(entry => Number(entry.split(':')[1]));
  assert.ok(scores.length >= 2);
  assert.deepEqual(scores, [...scores].sort((a, b) => a - b));
  await delay(50);
  assert.equal(log.at(-1), 'finish done');
});

test('checkpoint scores never go down and the final score must cover them', async t => {
  const sent = [];
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    sent.push(JSON.parse(options.body).score);
    return noContent();
  });
  const scores = [10, 3];
  const run = new LeaderboardRun(new LeaderboardClient(''), session, () => scores.shift() ?? 0, fast);
  run.start();
  await delay(70);
  run.stop();
  assert.deepEqual(sent.slice(0, 2), [10, 10]);
  await assert.rejects(run.finish(9), LeaderboardError);
});

test('temporary checkpoint failures are skipped and the next tick tries again', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async url => {
    if (url.endsWith('/finish')) return json(result);
    calls++;
    if (calls === 1) throw new TypeError('Failed to fetch');
    if (calls === 2) return json({ error: 'busy' }, 503);
    return noContent();
  });
  const run = new LeaderboardRun(new LeaderboardClient(''), session, () => 1, fast);
  run.start();
  await delay(90);
  assert.ok(calls >= 3);
  assert.equal(run.lostError, undefined);
  assert.equal((await run.finish(1000)).score, 1000);
});

test('a run the backend drops stops checkpointing and is never finished', async t => {
  for (const status of [401, 404, 422]) {
    await t.test(String(status), async t => {
      const fetch = t.mock.method(globalThis, 'fetch', async () => json({ error: 'run rejected' }, status));
      const run = new LeaderboardRun(new LeaderboardClient(''), session, () => 1, fast);
      let lost;
      run.onLost = error => { lost = error; };
      run.start();
      await delay(70);
      assert.equal(fetch.mock.callCount(), 1);
      assert.equal(lost.status, status);
      assert.equal(run.lostError, lost);
      await assert.rejects(run.finish(1000), error => error === lost);
      assert.equal(fetch.mock.callCount(), 1);
    });
  }
});

test('a 409 checkpoint stops the checkpoints without dropping the run', async t => {
  const urls = [];
  t.mock.method(globalThis, 'fetch', async url => {
    urls.push(url.split('/').pop());
    return url.endsWith('/finish') ? json(result) : json({ error: 'already finished' }, 409);
  });
  const run = new LeaderboardRun(new LeaderboardClient(''), session, () => 1, fast);
  run.start();
  await delay(70);
  assert.deepEqual(urls, ['checkpoint']);
  assert.equal(run.lostError, undefined);
  await run.finish(1000);
  assert.deepEqual(urls, ['checkpoint', 'finish']);
});

test('finish retries temporary failures with the same score, honouring Retry-After', async t => {
  const bodies = [];
  const responses = [
    () => { throw new TypeError('Failed to fetch'); },
    () => json({ error: 'slow down' }, 429, { 'Retry-After': '0' }),
    () => json({ error: 'busy' }, 502),
    () => json(result),
  ];
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    bodies.push(options.body);
    return responses.shift()();
  });
  const run = new LeaderboardRun(new LeaderboardClient(''), session, () => 1, fast);
  assert.equal((await run.finish(1000)).score, 1000);
  assert.equal(bodies.length, 4);
  assert.ok(bodies.every(body => body === JSON.stringify({ score: 1000 })));
});

test('finish gives up after its attempts, can be retried with the same score only, and stops on 422', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => json({ error: 'busy' }, 503));
  const run = new LeaderboardRun(new LeaderboardClient(''), session, () => 1, { ...fast, finishAttempts: 2 });
  await assert.rejects(run.finish(1000), error => error.retryable);
  assert.equal(fetch.mock.callCount(), 2);
  await assert.rejects(run.finish(999), error => error.status === 409);
  assert.equal(fetch.mock.callCount(), 2);
  fetch.mock.mockImplementation(async () => json({ error: 'run rejected' }, 422));
  await assert.rejects(run.finish(1000), error => error.status === 422 && !error.retryable);
  assert.equal(run.lostError.status, 422);
  await assert.rejects(run.finish(1000), error => error.status === 422);
  assert.equal(fetch.mock.callCount(), 3);
});

test('stopping a run aborts its checkpoint and sends nothing more', async t => {
  let requestSignal;
  const fetch = t.mock.method(globalThis, 'fetch', (_url, { signal }) => new Promise((resolve, reject) => {
    requestSignal = signal;
    signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
  }));
  const run = new LeaderboardRun(new LeaderboardClient(''), session, () => 1, fast);
  run.start();
  await delay(30);
  run.stop();
  await delay(50);
  assert.equal(requestSignal.aborted, true);
  assert.equal(fetch.mock.callCount(), 1);
  assert.equal(run.lostError, undefined);
});
