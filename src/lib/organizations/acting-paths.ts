/**
 * Which dashboard pages exist for someone operating a business for an
 * organization. Pure and database-free, because the proxy runs it on
 * every request.
 *
 * This is a coarse first filter, not the permission check: each of
 * these pages checks the delegate's scopes itself (requireDashboardAccess),
 * and every API route checks again. What it adds is that the owner-only
 * pages — billing, publishing, settings outside the delegated tabs,
 * offers, branches, import… — are not reachable at all while acting,
 * whatever the URL typed.
 */

export const ACTING_COOKIE = "maw3ed-acting";

const DELEGATE_PAGES: RegExp[] = [
  /^\/dashboard$/,
  /^\/dashboard\/bookings(\/(today|upcoming))?$/,
  /^\/dashboard\/calendar$/,
  /^\/dashboard\/check-in$/,
  /^\/dashboard\/customers(\/[^/]+)?$/,
  /^\/dashboard\/services$/,
  /^\/dashboard\/staff$/,
  /^\/dashboard\/settings$/,
  /^\/dashboard\/reports(\/(bookings|revenue|customers|performance))?$/,
];

/** Where to send a dashboard request made while acting, or null to let it through. */
export function actingRedirect(pathname: string, acting: boolean): string | null {
  if (!acting) return null;
  const en = pathname === "/en/dashboard" || pathname.startsWith("/en/dashboard/");
  const path = en ? pathname.slice(3) : pathname;
  if (path !== "/dashboard" && !path.startsWith("/dashboard/")) return null;
  const trimmed = path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
  if (DELEGATE_PAGES.some((re) => re.test(trimmed))) return null;
  return en ? "/en/dashboard" : "/dashboard";
}
