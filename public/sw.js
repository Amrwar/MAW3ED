/*
 * Maw3ed service worker.
 *
 * Deliberately small. Two things:
 *
 * 1. An offline page when a page cannot be reached.
 *
 * 2. The customer's own booking page (/booking/<token>, /en/booking/<token>)
 *    kept for use without a connection — so the check-in QR is still there
 *    at a venue with no signal. Nothing else is ever kept: no other page,
 *    no API response, no asset; a booking site showing yesterday's free
 *    times, or someone else's signed-in page, would be worse than nothing.
 *
 *    The page says how long it may be kept, in
 *    <meta name="maw3ed-offline-until" content="ISO instant"> — until its
 *    check-in window closes, and only while it has a code to show
 *    (src/lib/access/offline-copy.ts). The network always comes first: a
 *    copy is served only when the page cannot be fetched, and only before
 *    it expires. Fetching the page online replaces the copy, or deletes it
 *    when the page no longer carries the tag (cancelled, finished, gone).
 *    A kept code is safe to show: whether it is good is decided online
 *    when it is scanned.
 *
 * Bump VERSION when offline.html changes, so the new one is fetched.
 */
const VERSION = "v2";
const CACHE = `maw3ed-offline-${VERSION}`;
const BOOKINGS = "maw3ed-bookings-v1";
const OFFLINE_URL = "/offline.html";
const OFFLINE_ASSETS = [OFFLINE_URL, "/android-chrome-192x192.png"];
const BOOKING_PATH = /^\/(?:en\/)?booking\/[A-Za-z0-9_-]{16,}\/?$/;
const UNTIL_TAG = /<meta[^>]+name="maw3ed-offline-until"[^>]+content="([^"]+)"/;
const UNTIL_HEADER = "x-maw3ed-offline-until";
const SAVED_HEADER = "x-maw3ed-saved-at";
/** A phone keeps at most this many booking pages; the oldest go first. */
const MAX_BOOKINGS = 10;

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
      .then(() => purgeExpired())
      .then(() => self.clients.claim()),
  );
});

/** The cache key of a booking page: its path, without query or hash. */
function bookingKey(url) {
  return new URL(url.pathname, url.origin).href;
}

async function purgeExpired() {
  const cache = await caches.open(BOOKINGS);
  const now = Date.now();
  const kept = [];
  for (const req of await cache.keys()) {
    const res = await cache.match(req);
    const until = Date.parse(res?.headers.get(UNTIL_HEADER) ?? "");
    if (!res || !(until > now)) await cache.delete(req);
    else kept.push({ req, saved: Date.parse(res.headers.get(SAVED_HEADER) ?? "") || 0 });
  }
  kept.sort((a, b) => b.saved - a.saved);
  for (const { req } of kept.slice(MAX_BOOKINGS)) await cache.delete(req);
}

/** Keeps the fetched booking page, or forgets it when it may not be kept. */
async function remember(key, response) {
  const cache = await caches.open(BOOKINGS);
  const html = response.ok ? await response.text() : "";
  const until = Date.parse((html.match(UNTIL_TAG) || [])[1] || "");
  if (!response.ok || !(until > Date.now())) {
    await cache.delete(key);
    return;
  }
  const headers = new Headers({ "content-type": "text/html; charset=utf-8" });
  headers.set(UNTIL_HEADER, new Date(until).toISOString());
  headers.set(SAVED_HEADER, new Date().toISOString());
  await cache.put(key, new Response(html, { status: 200, headers }));
  await purgeExpired();
}

/** The kept copy, while it is still valid; null otherwise. */
async function keptCopy(key) {
  const cache = await caches.open(BOOKINGS);
  const res = await cache.match(key);
  if (!res) return null;
  if (!(Date.parse(res.headers.get(UNTIL_HEADER) ?? "") > Date.now())) {
    await cache.delete(key);
    return null;
  }
  return res;
}

async function offlinePage() {
  return (await caches.match(OFFLINE_URL)) || Response.error();
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // Page loads only: the network, and the offline page when there is none.
  if (request.mode === "navigate") {
    if (url.origin === self.location.origin && BOOKING_PATH.test(url.pathname)) {
      const key = bookingKey(url);
      event.respondWith(
        fetch(request)
          .then((response) => {
            event.waitUntil(remember(key, response.clone()).catch(() => {}));
            return response;
          })
          .catch(async () => (await keptCopy(key)) || offlinePage()),
      );
      return;
    }
    event.respondWith(fetch(request).catch(() => offlinePage()));
    return;
  }

  // The offline page's own icon, when the network is gone.
  if (url.pathname === "/android-chrome-192x192.png") {
    event.respondWith(fetch(request).catch(() => caches.match(request).then((r) => r || Response.error())));
  }
});
