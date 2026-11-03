/*
 * Maw3ed service worker.
 *
 * Deliberately small. Two things:
 *
 * 1. An offline page when a page cannot be reached.
 *
 * 2. The customer's own booking page (/booking/<token>) kept for use without
 *    a connection — so the check-in QR is still there at a venue with no
 *    signal. Nothing else is kept: no other page, no API response, and no
 *    asset except the scripts and styles a kept booking page itself loads
 *    (hashed, immutable files); a booking site showing yesterday's free
 *    times, or someone else's signed-in page, would be worse than nothing.
 *
 *    The page says what may be done with it, in
 *    <meta name="maw3ed-offline-until" content="…">:
 *      - an ISO instant: keep it until then (its check-in window closes;
 *        src/lib/access/offline-copy.ts);
 *      - "none": it has nothing to show any more (cancelled, finished) —
 *        forget any copy.
 *    No tag, or a server error, says nothing: an existing copy is kept, so
 *    a deploy or a database blip does not wipe the code a customer needs.
 *    A 404 (no such booking) forgets it.
 *
 *    The network comes first, but not for long: if it has not answered in
 *    NETWORK_WAIT_MS and a copy exists, the copy is shown (weak signal at a
 *    venue), and the network's answer, when it comes, refreshes the copy.
 *    The page itself asks for a refresh when it changes without a page
 *    load (a new code, a pass issued, a cancellation): message
 *    { type: "maw3ed:refresh-booking", path }.
 *    A kept code is safe to show: whether it is good is decided online
 *    when it is scanned.
 *
 * Bump VERSION when offline.html changes, so the new one is fetched.
 */
const VERSION = "v2";
const CACHE = `maw3ed-offline-${VERSION}`;
const BOOKINGS = "maw3ed-bookings-v1";
const ASSETS = "maw3ed-booking-assets-v1";
const OFFLINE_URL = "/offline.html";
const OFFLINE_ASSETS = [OFFLINE_URL, "/android-chrome-192x192.png"];
// /en/booking/<token> is redirected to /booking/<token> (one address).
const BOOKING_PATH = /^\/booking\/[A-Za-z0-9_-]{16,}\/?$/;
const UNTIL_TAG = /<meta[^>]+name="maw3ed-offline-until"[^>]+content="([^"]+)"/;
const STATIC_REF = /\/_next\/static\/[^"'\s)>]+\.(?:js|css|woff2)/g;
const UNTIL_HEADER = "x-maw3ed-offline-until";
const SAVED_HEADER = "x-maw3ed-saved-at";
const ASSETS_HEADER = "x-maw3ed-assets";
/** A phone keeps at most this many booking pages; the oldest go first. */
const MAX_BOOKINGS = 10;
/** How long a booking page waits for the network before showing a kept copy. */
const NETWORK_WAIT_MS = 3500;

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
      .then(() => purge())
      .then(() => self.clients.claim()),
  );
});

/** The cache key of a booking page: its path, without query, hash or trailing slash. */
function bookingKey(origin, pathname) {
  return new URL(pathname.replace(/\/$/, ""), origin).href;
}

/** Drops expired pages, keeps the newest MAX_BOOKINGS, and the assets only they use. */
async function purge() {
  const cache = await caches.open(BOOKINGS);
  const now = Date.now();
  const rows = await Promise.all((await cache.keys()).map(async (req) => ({ req, res: await cache.match(req) })));
  const live = [];
  const gone = [];
  for (const { req, res } of rows) {
    const until = Date.parse(res?.headers.get(UNTIL_HEADER) ?? "");
    if (res && until > now) live.push({ req, res, saved: Date.parse(res.headers.get(SAVED_HEADER) ?? "") || 0 });
    else gone.push(req);
  }
  live.sort((a, b) => b.saved - a.saved);
  gone.push(...live.slice(MAX_BOOKINGS).map((r) => r.req));
  const kept = live.slice(0, MAX_BOOKINGS);
  await Promise.all(gone.map((req) => cache.delete(req)));
  const used = new Set(kept.flatMap((r) => (r.res.headers.get(ASSETS_HEADER) ?? "").split(" ").filter(Boolean)));
  const assets = await caches.open(ASSETS);
  await Promise.all((await assets.keys()).filter((req) => !used.has(new URL(req.url).pathname)).map((req) => assets.delete(req)));
}

/** Keeps the fetched booking page (and its scripts and styles), or forgets it when told to. */
async function remember(key, response) {
  if (response.status === 404) {
    await (await caches.open(BOOKINGS)).delete(key);
    await purge();
    return;
  }
  // A server error, a redirect, an opaque answer: say nothing, keep what is kept.
  if (!response.ok || response.type === "opaqueredirect") return;
  const html = await response.text();
  const tag = (html.match(UNTIL_TAG) || [])[1];
  if (!tag) return;
  const cache = await caches.open(BOOKINGS);
  const until = Date.parse(tag);
  if (tag === "none" || !(until > Date.now())) {
    await cache.delete(key);
    await purge();
    return;
  }
  const refs = [...new Set(html.match(STATIC_REF) || [])];
  const assets = await caches.open(ASSETS);
  await Promise.all(
    refs.map(async (path) => {
      if (await assets.match(path)) return;
      try {
        const res = await fetch(path);
        if (res.ok) await assets.put(path, res);
      } catch {
        // The browser's own cache may still have it; nothing to do.
      }
    }),
  );
  const headers = new Headers({ "content-type": "text/html; charset=utf-8" });
  headers.set(UNTIL_HEADER, new Date(until).toISOString());
  headers.set(SAVED_HEADER, new Date().toISOString());
  headers.set(ASSETS_HEADER, refs.join(" "));
  await cache.put(key, new Response(html, { status: 200, headers }));
  await purge();
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

/** Network first, a kept copy when the network fails, errs or is too slow. */
function bookingPage(event, request, key) {
  const network = fetch(request);
  event.waitUntil(
    network.then((response) => remember(key, response.clone())).catch(() => {}),
  );
  return new Promise((resolve) => {
    let settled = false;
    const done = (r) => {
      if (!settled) {
        settled = true;
        resolve(r);
      }
    };
    const timer = setTimeout(async () => {
      const copy = await keptCopy(key);
      if (copy) done(copy);
    }, NETWORK_WAIT_MS);
    network
      .then(async (response) => {
        // The server is having trouble: the copy, if there is one.
        if (response.status >= 500) {
          const copy = await keptCopy(key);
          if (copy) return done(copy);
        }
        done(response);
      })
      .catch(async () => done((await keptCopy(key)) || (await offlinePage())))
      .finally(() => clearTimeout(timer));
  });
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  const own = url.origin === self.location.origin;

  // Page loads only: the network, and the offline page when there is none.
  if (request.mode === "navigate") {
    if (own && BOOKING_PATH.test(url.pathname)) {
      event.respondWith(bookingPage(event, request, bookingKey(url.origin, url.pathname)));
      return;
    }
    event.respondWith(fetch(request).catch(() => offlinePage()));
    return;
  }

  // A kept booking page's own scripts and styles, when the network is gone.
  if (own && url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      fetch(request).catch(async () => (await (await caches.open(ASSETS)).match(url.pathname)) || Response.error()),
    );
    return;
  }

  // The offline page's own icon, when the network is gone.
  if (url.pathname === "/android-chrome-192x192.png") {
    event.respondWith(fetch(request).catch(() => caches.match(request).then((r) => r || Response.error())));
  }
});

// The page changed without a page load (a new code, a pass, a cancellation):
// fetch it again so the kept copy matches what the customer now has.
self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type !== "maw3ed:refresh-booking" || typeof data.path !== "string" || !BOOKING_PATH.test(data.path)) return;
  const key = bookingKey(self.location.origin, data.path);
  event.waitUntil(
    fetch(data.path, { credentials: "same-origin", headers: { accept: "text/html" } })
      .then((response) => remember(key, response))
      .catch(() => {}),
  );
});
