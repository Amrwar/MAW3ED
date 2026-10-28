/*
 * Maw3ed service worker.
 *
 * Deliberately small: it serves an offline page when a page cannot be
 * reached, and nothing else. It does not cache pages, API responses or
 * assets — a booking site showing yesterday's free times, or someone
 * else's signed-in page, would be worse than showing nothing. Next's own
 * hashed assets are already cached by the browser.
 *
 * Bump VERSION when offline.html changes, so the new one is fetched.
 */
const VERSION = "v1";
const CACHE = `maw3ed-offline-${VERSION}`;
const OFFLINE_URL = "/offline.html";
const OFFLINE_ASSETS = [OFFLINE_URL, "/android-chrome-192x192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(OFFLINE_ASSETS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("maw3ed-offline-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  // Page loads only: the network, and the offline page when there is none.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL).then((r) => r || Response.error())),
    );
    return;
  }

  // The offline page's own icon, when the network is gone.
  if (new URL(request.url).pathname === "/android-chrome-192x192.png") {
    event.respondWith(fetch(request).catch(() => caches.match(request).then((r) => r || Response.error())));
  }
});
