import type { Href } from "expo-router";

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
  | "/(business)/customers"
  | "/(business)/notifications"
  | "/(business)/account"
  | "/(admin)"
  | `/business/${string}`
  | `/booking/${string}`;

/** The hosts whose links are ours. Anything else is not opened in the app. */
const OUR_HOSTS = new Set(["maw3ed.net", "www.maw3ed.net"]);

/** Website path prefix → app route. First match wins, so order matters. */
const TABLE: [prefix: string, route: AppRoute][] = [
  ["/account/upcoming", "/(customer)/bookings"],
  ["/account/history", "/(customer)/bookings"],
  ["/account/favorites", "/(customer)/favorites"],
  ["/account/notifications", "/(customer)/notifications"],
  ["/notifications", "/(customer)/notifications"],
  ["/account", "/(customer)/account"],
  ["/businesses", "/(customer)/search"],

  ["/dashboard/calendar", "/(business)/calendar"],
  // The app has no bookings list: the calendar is where they are.
  ["/dashboard/bookings", "/(business)/calendar"],
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
  // A business page opens the business screen. The slug may hold what
  // the server's slugify() leaves — lowercase letters, digits, "_" and
  // "-" — and nothing else is passed into a route.
  const company = /^\/company\/([a-z0-9_-]{1,100})$/.exec(normalised);
  if (company) return `/business/${company[1]}`;
  if (normalised === "/company" || normalised.startsWith("/company/")) return "/(customer)/search";
  // A booking's own page: the token is the authorisation, so only its
  // own characters pass into the route. Anything else under /booking is
  // not a booking the app can open.
  const booking = /^\/booking\/([A-Za-z0-9]{16,128})$/.exec(normalised);
  if (booking) return `/booking/${booking[1]}`;
  if (normalised === "/booking" || normalised.startsWith("/booking/")) return "/(customer)/bookings";
  for (const [prefix, route] of TABLE) {
    const bare = prefix.replace(/\/$/, "");
    // Whole segments only: "/account" must not match "/accounting".
    if (normalised === bare || normalised.startsWith(bare + "/")) return route;
  }
  return "/";
}

/**
 * routeFor, as the router's own type. The dynamic booking route is
 * typed by expo-router's generated file, which this module cannot see
 * from the vitest side; every route here is one that exists.
 */
export function hrefFor(input: string): Href {
  return routeFor(input) as Href;
}
