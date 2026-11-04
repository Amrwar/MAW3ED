/**
 * The booking page talking to the service worker that keeps it for use
 * without a connection (public/sw.js). Browser only; each is a harmless
 * no-op without a controlling service worker.
 */

/** Sends a message and waits for the worker's reply on a port, or gives up. */
function ask<T>(message: Record<string, unknown>, timeoutMs: number): Promise<T | null> {
  const sw = typeof navigator !== "undefined" ? navigator.serviceWorker?.controller : null;
  if (!sw) return Promise.resolve(null);
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => resolve(null), timeoutMs);
    channel.port1.onmessage = (e) => {
      clearTimeout(timer);
      resolve(e.data as T);
    };
    try {
      sw.postMessage(message, [channel.port2]);
    } catch {
      clearTimeout(timer);
      resolve(null);
    }
  });
}

/**
 * Asks the worker to fetch this booking page again, so the copy the phone
 * keeps matches what the customer now has: after a new code, a pass issued
 * or withdrawn, a cancellation — changes the page makes without a page
 * load. True once the worker has stored (or rightly forgotten) the page.
 */
export async function refreshKeptBookingPage(): Promise<boolean> {
  const r = await ask<{ ok: boolean }>({ type: "maw3ed:refresh-booking", path: window.location.pathname }, 20_000);
  return !!r?.ok;
}

/** Whether this page was shown from a kept copy, and when that copy was saved. */
export async function servedFromKeptCopy(): Promise<{ copy: boolean; savedAt: string | null } | null> {
  return ask({ type: "maw3ed:was-copy" }, 1_000);
}

/**
 * The scripts, styles and fonts this page loaded after it started (code
 * split chunks, fonts named only in the CSS), for the worker to keep with
 * the page so a kept copy works fully offline.
 */
export function keepPageAssets(): void {
  try {
    const sw = navigator.serviceWorker?.controller;
    if (!sw) return;
    const assets = performance
      .getEntriesByType("resource")
      .map((e) => new URL(e.name, location.origin))
      .filter((u) => u.origin === location.origin && u.pathname.startsWith("/_next/static/"))
      .map((u) => u.pathname);
    if (assets.length) sw.postMessage({ type: "maw3ed:keep-assets", path: location.pathname, assets: [...new Set(assets)] });
  } catch {
    // Nothing depends on it.
  }
}
