import {manifest, version} from '@parcel/service-worker';

// the WebWorker lib types the global scope as a dedicated worker; this script runs as a service worker
declare const self: ServiceWorkerGlobalScope;

const SERVICES_URL = "https://www.0x29a.me/services.json";

async function install() {
  const cache = await caches.open(version);
  await cache.addAll(manifest);
  // Best effort so the list survives an offline start right after an update.
  await cache.add(SERVICES_URL).catch(() => {});
}
self.addEventListener("install", e => e.waitUntil(install()));

async function activate() {
  const keys = await caches.keys();
  await Promise.all(
    keys.map(key => key !== version && caches.delete(key))
  );
}
self.addEventListener("activate", e => e.waitUntil(activate()));

// The service list changes independently of deploys: network first, cached copy offline.
async function networkFirst(request: Request) {
  const cache = await caches.open(version);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error;
  }
}

self.addEventListener('fetch', (event: FetchEvent) => {
  if (event.request.url === SERVICES_URL) {
    event.respondWith(networkFirst(event.request));
    return;
  }
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
