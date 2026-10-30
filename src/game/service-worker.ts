import {manifest, version} from '@parcel/service-worker';

// the WebWorker lib types the global scope as a dedicated worker; this script runs as a service worker
declare const self: ServiceWorkerGlobalScope;

async function install() {
  const cache = await caches.open(version);
  await cache.addAll(manifest);
}
self.addEventListener("install", e => e.waitUntil(install()));

async function activate() {
  const keys = await caches.keys();
  await Promise.all(
    keys.map(key => key !== version && caches.delete(key))
  );
}
self.addEventListener("activate", e => e.waitUntil(activate()));

self.addEventListener('fetch', (event: FetchEvent) => {
  // Session tokens and live scores must always go to the network, even in the installed PWA.
  if (event.request.method !== 'GET' || new URL(event.request.url).pathname.includes('/api/v1/')) return;
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
