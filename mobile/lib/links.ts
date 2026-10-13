/**
 * Where a link lands in the app.
 *
 * Links reach the app three ways, and all three come through here:
 *
 *   - a maw3ed.net link tapped elsewhere (universal / app links),
 *   - a maw3ed:// link,
 *   - the `href` on a notification — the website's own path, the same
 *     one the email button and the in-app feed use, so the server needs
 *     no notion of the app to send somebody to the right place.
 *
 * Website paths are translated to app routes in one table. A page the
 * app does not have yet lands on the nearest screen that does — never
 * on a "not found", which is what an unmatched route would show. When
 * the business profile and booking screens exist, their rows change and
 * nothing else does.
 */

export type AppRoute =
  | "/"
  | "/(customer)"
  | "/(customer)/search"
  | "/(customer)/bookings"
  | "/(customer)/favorites"
  | "/(customer)/notifications"
  | "/(customer)/account"
  | "/(business)"
  | "/(business)/calendar"
  | "/(business)/bookings"
  | "/(business)/customers"
  | "/(business)/notifications"
  | "/(business)/account"
  | "/(admin)";

/** The hosts whose links are ours. Anything else is not opened in the app. */
const OUR_HOSTS = new Set(["maw3ed.net", "www.maw3ed.net"]);

/** Website path prefix → app route. First match wins, so order matters. */
const TABLE: [prefix: string, route: AppRoute][] = [
  // Not built yet in the app — the nearest screen until they are.
  ["/company/", "/(customer)/search"],
  ["/booking/", "/(customer)/bookings"],

  ["/account/upcoming", "/(customer)/bookings"],
  ["/account/history", "/(customer)/bookings"],
  ["/account/favorites", "/(customer)/favorites"],
  ["/account/notifications", "/(customer)/notifications"],
  ["/notifications", "/(customer)/notifications"],
  ["/account", "/(customer)/account"],
  ["/businesses", "/(customer)/search"],

  ["/dashboard/calendar", "/(business)/calendar"],
  ["/dashboard/bookings", "/(business)/bookings"],
  ["/dashboard/customers", "/(business)/customers"],
  ["/dashboard/settings", "/(business)/account"],
  ["/dashboard", "/(business)"],

  ["/admin", "/(admin)"],
];

/**
 * The path part of anything that might be a link to us, or null when it
 * is somebody else's link. Accepts a full https URL on our domain, a
 * maw3ed:// URL, or a bare path.
 */
export function ourPath(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  if (raw.startsWith("/")) return raw.split(/[?#]/)[0] ?? "/";

  if (raw.startsWith("maw3ed://")) {
    // maw3ed://company/x parses "company" as the host, so read it by hand.
    const rest = raw.slice("maw3ed://".length).split(/[?#]/)[0] ?? "";
    return "/" + rest.replace(/^\/+/, "");
  }

  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || !OUR_HOSTS.has(url.hostname)) return null;
    return url.pathname || "/";
  } catch {
    return null;
  }
}

/** The app route for a website path or link. Home when nothing matches. */
export function routeFor(input: string): AppRoute {
  const path = ourPath(input);
  if (!path || path === "/") return "/";
  const normalised = path.replace(/\/+$/, "") || "/";
  for (const [prefix, route] of TABLE) {
    const bare = prefix.replace(/\/$/, "");
    // Whole segments only: "/account" must not match "/accounting".
    if (normalised === bare || normalised.startsWith(bare + "/")) return route;
  }
  return "/";
}
