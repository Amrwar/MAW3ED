import type { Href } from "expo-router";

/**
 * Where a link lands in the app.
 *
 * One Maw3ed link works everywhere: it is always a www.maw3ed.net page.
 * With the app installed, iOS (universal links) and Android (app links)
 * hand it to the app instead of the browser, and it comes through here;
 * without the app, the same link is simply the web page. So every link
 * the system writes — QR codes, shares, notifications, confirmation
 * emails and WhatsApps — is a web URL, and nothing is ever broken for
 * somebody without the app.
 *
 * Links reach this module from:
 *   - a maw3ed.net link opened from anywhere (app/+native-intent.tsx),
 *   - a maw3ed:// link (development and staging builds),
 *   - a push notification's `path`, and an in-app notification's `href`
 *     (the website's own path — the server knows nothing of the app).
 *
 * Website paths become app routes here and only here. What travels on:
 * the business, the service and staff member a link preselects, its
 * source (src/ref, for attribution), and a booking's token — each
 * checked against the characters it may contain, so nothing a link says
 * reaches a route unvalidated. A page the app does not have lands on the
 * nearest screen that does, never on "not found".
 *
 * Opening a link never grants anything. A booking's page is reached by
 * its token, exactly as on the web; everything else that is private —
 * a customer's bookings, the business side — sits behind sign-in and
 * the server's checks on every request.
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
  | "/nearby"
  | `/business/${string}`
  | `/book/${string}`
  | `/booking/${string}`
  | `/manage/booking/${string}`;

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
  ["/search", "/(customer)/search"],
  ["/nearby", "/nearby"],

  ["/dashboard/calendar", "/(business)/calendar"],
  // The app has no bookings list: the calendar is where they are.
  ["/dashboard/bookings", "/(business)/calendar"],
  ["/dashboard/customers", "/(business)/customers"],
  ["/dashboard/settings", "/(business)/account"],
  ["/dashboard", "/(business)"],

  ["/admin", "/(admin)"],
];

/** What each kind of value may look like before it is put in a route. */
const SLUG = /^[a-z0-9_-]{1,100}$/;
const TOKEN = /^[A-Za-z0-9]{16,128}$/;
/** cuid()s, and the seed's readable ids ("qa-dr-1"). */
const ID = /^[A-Za-z0-9_-]{1,64}$/;
const SOURCE = /^[a-z0-9_-]{1,32}$/;

export interface Link {
  path: string;
  query: URLSearchParams;
  /** Without the "#". */
  hash: string;
}

/**
 * The path and query of anything that might be a link to us, or null
 * when it is somebody else's. Accepts a full https URL on our domain, a
 * maw3ed:// URL, or a bare path.
 */
export function parseLink(input: string): Link | null {
  const raw = input.trim();
  if (!raw) return null;
  const split = (rest: string): Link => {
    const [pathAndQuery = "", hash = ""] = rest.split("#");
    const [path = "/", search = ""] = pathAndQuery.split("?");
    return { path: path || "/", query: new URLSearchParams(search), hash };
  };

  if (raw.startsWith("/")) return split(raw);
  if (raw.startsWith("maw3ed://")) {
    // maw3ed://company/x parses "company" as the host, so read it by hand.
    return split("/" + raw.slice("maw3ed://".length).replace(/^\/+/, ""));
  }
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || !OUR_HOSTS.has(url.hostname)) return null;
    return { path: url.pathname || "/", query: url.searchParams, hash: url.hash.replace(/^#/, "") };
  } catch {
    return null;
  }
}

/** The path part of a link to us, or null. */
export function ourPath(input: string): string | null {
  return parseLink(input)?.path ?? null;
}

/** "?a=1&b=2" from the pairs whose values passed their check; "" when none did. */
function queryOf(pairs: [string, string | null, RegExp][]): string {
  const kept = pairs.filter(([, v, re]) => v !== null && re.test(v)) as [string, string, RegExp][];
  return kept.length ? "?" + kept.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&") : "";
}

/** The app route for a website path or link. Home when nothing matches. */
export function routeFor(input: string): AppRoute {
  const link = parseLink(input);
  if (!link) return "/";
  // The website serves English at /en/… and redirects /ar/… to the bare
  // path; the app is one app in either language, so the prefix goes.
  const path = link.path.replace(/\/+$/, "").replace(/^\/(?:en|ar)(?=\/|$)/, "") || "/";
  if (path === "/") return "/";
  const q = link.query;
  const source = q.get("src") ?? q.get("ref");

  // A business: its page, or — when the link names a service — straight
  // into booking that service (and staff member), as the web's
  // ?service=&staff= preselects its booking form.
  const company = /^\/company\/([^/]+)$/.exec(path);
  if (company) {
    const slug = company[1]!;
    if (!SLUG.test(slug)) return "/(customer)/search";
    const service = q.get("service");
    if (service && ID.test(service)) {
      return `/book/${slug}${queryOf([
        ["service", service, ID],
        ["staff", q.get("staff"), ID],
        ["src", source, SOURCE],
      ])}`;
    }
    return `/business/${slug}${queryOf([["src", source, SOURCE]])}`;
  }
  if (path === "/company" || path.startsWith("/company/")) return "/(customer)/search";

  // A booking's own page, and its reschedule and review steps — which
  // the website addresses as #reschedule and #review on the same page
  // (the account pages and the review request link there). The token is
  // the authorisation, so only its own characters pass into a route.
  const booking = /^\/booking\/([^/]+)(?:\/(reschedule|review))?$/.exec(path);
  if (booking) {
    const token = booking[1]!;
    if (!TOKEN.test(token)) return "/(customer)/bookings";
    const step = booking[2] ?? (link.hash === "review" || link.hash === "reschedule" ? link.hash : null);
    return `/booking/${token}${step ? `/${step}` : ""}`;
  }
  if (path === "/booking" || path.startsWith("/booking/")) return "/(customer)/bookings";

  // A business notification about one booking: the server adds the id
  // (src/lib/notifications/recipients.ts); the business side opens it,
  // and the server decides whether this person may see it.
  if (path === "/dashboard/bookings") {
    const id = q.get("booking");
    if (id && ID.test(id)) return `/manage/booking/${id}`;
  }

  for (const [prefix, route] of TABLE) {
    // Whole segments only: "/account" must not match "/accounting".
    if (path === prefix || path.startsWith(prefix + "/")) return route;
  }
  return "/";
}

/**
 * routeFor, as the router's own type. The dynamic routes are typed by
 * expo-router's generated file, which this module cannot see from the
 * vitest side; every route here is one that exists.
 */
export function hrefFor(input: string): Href {
  return routeFor(input) as Href;
}
