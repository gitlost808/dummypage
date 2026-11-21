// The voice status page moved from /ts-status/ to /mumble-status/, and www redirects the old path.
// Copies installed or visited before the move run a cache-first worker scoped to /ts-status/, so
// they never reach that redirect: this replacement is what their next update check fetches. It
// deletes the caches, unregisters, and sends open status tabs to the new page.
//
// It deletes every cache, not only the status page's: each page's worker precached the whole site
// under its own name, so the status page's cannot be told apart, and each worker's activate already
// deletes the others' caches. The other pages use the network until their workers next update.
//
// TODO: remove this worker, the /ts-status/ stub page, their `source` entries, and infra's Nginx
// exception for this path once www has redirected /ts-status/ for one to three months.

// A module, like the other workers, so this declaration of self stays local to the file.
export {};

// the WebWorker lib types the global scope as a dedicated worker; this script runs as a service worker
declare const self: ServiceWorkerGlobalScope;

self.addEventListener("install", () => self.skipWaiting());

async function retire() {
  // skipWaiting alone leaves open status pages uncontrolled: matchAll would not list them, and
  // navigate() only works on pages this worker controls.
  await self.clients.claim();
  const keys = await caches.keys();
  await Promise.all(keys.map(key => caches.delete(key)));
  const windows = await self.clients.matchAll({ type: "window" });
  // Navigations skip an unregistered worker, so the new page loads from the network.
  await self.registration.unregister();
  await Promise.all(
    windows.map(client => client.navigate("/mumble-status/").catch(() => undefined)),
  );
}
self.addEventListener("activate", e => e.waitUntil(retire()));
