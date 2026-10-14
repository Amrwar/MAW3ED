import { router, type Href } from "expo-router";

/**
 * Back, or — when there is nothing to go back to (a screen opened from a
 * link, a notification or a reload on web) — the given screen instead.
 * router.back() on an empty stack does nothing at all (GO_BACK is not
 * handled), which leaves somebody tapping a dead button.
 */
export function goBack(fallback: Href = "/"): void {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}
