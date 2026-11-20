// The game moved to https://spacegame.0x29a.me, and www redirects /game/ there. Copies of the game
// installed from www run a cache-first worker scoped to /game/, so they never reach that redirect:
// this replacement is what their next update check fetches. It deletes the caches, unregisters,
// and reloads open game tabs so they land on the redirect.
//
// It deletes every cache, not only the game's: each page's worker precached the whole site under
// its own name, so the game's cannot be told apart, and each worker's activate already deletes the
// others' caches. The other pages use the network until their workers next update.
//
// TODO: remove this worker, its `source` entry, and infra's Nginx exception for its path once www
// has redirected /game/ for one to three months (phase 4 of infra's docs/plans/spacegame-split.md).

// A module, like the other workers, so this declaration of self stays local to the file.
export {};

// the WebWorker lib types the global scope as a dedicated worker; this script runs as a service worker
declare const self: ServiceWorkerGlobalScope;

self.addEventListener("install", () => self.skipWaiting());

async function retire() {
  // skipWaiting alone leaves open game pages uncontrolled: matchAll would not list them, and
  // navigate() only works on pages this worker controls.
  await self.clients.claim();
  const keys = await caches.keys();
  await Promise.all(keys.map(key => caches.delete(key)));
  const windows = await self.clients.matchAll({ type: "window" });
  // Navigations skip an unregistered worker, so the reloads below reach www and its redirect.
  await self.registration.unregister();
  await Promise.all(windows.map(client => client.navigate(client.url).catch(() => undefined)));
}
self.addEventListener("activate", e => e.waitUntil(retire()));
