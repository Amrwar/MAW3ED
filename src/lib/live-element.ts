/**
 * Finding the element a visitor can actually see.
 *
 * React streams the server shell into a `<div hidden id="S:0">` and
 * swaps it into place once hydration completes. When hydration bails
 * out — which happens site-wide on this app, see the note in
 * StickyBookingBar — that copy stays in the document. Every id on the
 * page then matches twice, and document.getElementById hands back the
 * hidden one, because it comes first.
 *
 * Anything keyed on an id therefore has to ask for the rendered copy
 * rather than the first one: an IntersectionObserver pointed at a
 * display:none element never reports, so a scroll-spy silently sticks
 * on its first tab and a reveal-on-scroll bar never reveals.
 */

/** The last matching element that is actually laid out, or null. */
export function liveElementById(id: string): HTMLElement | null {
  if (typeof document === "undefined" || !id) return null;

  const matches = document.querySelectorAll<HTMLElement>("#" + CSS.escape(id));
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0];

  // getClientRects() is empty for anything in a display:none subtree,
  // which is exactly what the stranded shell is.
  for (let i = matches.length - 1; i >= 0; i--) {
    if (matches[i].getClientRects().length > 0) return matches[i];
  }
  return matches[matches.length - 1];
}
