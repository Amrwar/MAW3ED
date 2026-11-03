/**
 * Asks the service worker to fetch this booking page again, so the copy the
 * phone keeps for offline use (public/sw.js) matches what the customer now
 * has: after a new code, a pass issued or withdrawn, or a cancellation —
 * changes the page makes without a page load. Browser only; a no-op without
 * a controlling service worker.
 */
export function refreshKeptBookingPage(): void {
  try {
    navigator.serviceWorker?.controller?.postMessage({ type: "maw3ed:refresh-booking", path: window.location.pathname });
  } catch {
    // Nothing depends on it.
  }
}
