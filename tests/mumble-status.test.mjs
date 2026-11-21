import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import vm from "node:vm";

const source = stripTypeScriptTypes(
  readFileSync(
    new URL("../src/ts-status/ts-status.ts", import.meta.url),
    "utf8",
  )
    .replace(/^import .*;\n/gm, "")
    .split('if ("serviceWorker" in navigator)')[0],
);

function page(fetch) {
  const elements = new Map();
  const timers = new Map();
  const element = () => ({
    textContent: "",
    children: [],
    listeners: new Map(),
    classList: { add() {} },
    replaceChildren(...children) {
      this.children = children;
    },
    prepend(icon) {
      this.icon = icon;
    },
    addEventListener(name, callback) {
      this.listeners.set(name, callback);
    },
  });
  let timerId = 0;
  const context = vm.createContext({
    document: {
      createElement: element,
      querySelector(selector) {
        if (!elements.has(selector)) elements.set(selector, element());
        return elements.get(selector);
      },
    },
    console: { error() {} },
    fetch,
    AbortSignal: { timeout() {} },
    setTimeout(callback) {
      timers.set(++timerId, callback);
      return timerId;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    bootPage() {},
  });
  vm.runInContext(source, context);
  return { elements, timers, run: (code) => vm.runInContext(code, context) };
}
const response = (users) => ({ ok: true, json: async () => ({ users }) });

test("counts Mumble clients and renders names as text with channel hints", async () => {
  const app = page(async (url, options) => {
    assert.equal(url, "https://mumble.0x29a.me/status/users");
    assert.equal(options.cache, "no-store");
    return response([
      { name: "<Alice>", channel: "Lobby" },
      { name: "Zoë", channel: "AFK" },
    ]);
  });
  await app.run("updateUserCount()");
  assert.equal(app.elements.get("live-value").value, "2");
  const users = app.elements.get("#userlist .player-list").children;
  assert.deepEqual(
    Array.from(users, (user) => [user.textContent, user.title]),
    [
      ["<Alice>", "Lobby"],
      ["Zoë", "AFK"],
    ],
  );
  assert.equal(app.timers.size, 1);
});

test("the WhatsApp bridge account is neither listed nor counted", async () => {
  const app = page(async () =>
    response([
      { name: "WhatsAppBridge", channel: "Lobby" },
      { name: "Alice", channel: "Lobby" },
    ]),
  );
  await app.run("updateUserCount()");
  assert.equal(app.elements.get("live-value").value, "1");
  assert.deepEqual(
    Array.from(
      app.elements.get("#userlist .player-list").children,
      (user) => user.textContent,
    ),
    ["Alice"],
  );
});

test("empty server is zero; HTTP failures and malformed responses clear stale users", async () => {
  for (const failure of [
    { ok: false, status: 503 },
    { ok: true, json: async () => ({ users: [{}] }) },
  ]) {
    let next = response([{ name: "Alice", channel: "Lobby" }]);
    const app = page(async () => next);
    await app.run("updateUserCount()");
    next = failure;
    await app.run("updateUserCount()");
    assert.equal(app.elements.get("live-value").value, "?");
    assert.equal(
      app.elements.get("#userlist .player-list").children[0].textContent,
      "Mumble status unavailable",
    );
    next = response([]);
    await app.run("updateUserCount()");
    assert.equal(app.elements.get("live-value").value, "0");
    assert.equal(
      app.elements.get("#userlist .player-list").children[0].textContent,
      "no users connected",
    );
  }
});

test("overlapping refreshes share a request and leave one poll timer", async () => {
  let resolve;
  let calls = 0;
  const app = page(() => {
    calls++;
    return new Promise((done) => {
      resolve = done;
    });
  });
  const first = app.run("updateUserCount()");
  const second = app.run("updateUserCount()");
  assert.equal(calls, 1);
  resolve(response([]));
  await Promise.all([first, second]);
  assert.equal(app.timers.size, 1);
});

test("ten failures stop polling and manual refresh can recover", async () => {
  let next = { ok: false, status: 503 };
  const app = page(async () => next);
  for (let i = 0; i < 10; i++) await app.run("updateUserCount()");
  assert.equal(app.timers.size, 0);
  app.run("setupRefreshButton()");
  next = response([]);
  await app.elements.get("#refreshButton").listeners.get("click")();
  assert.equal(app.elements.get("live-value").value, "0");
  assert.equal(app.timers.size, 1);
});
