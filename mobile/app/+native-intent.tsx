import { routeFor } from "@/lib/links";

/**
 * Every link the operating system hands the app — a maw3ed.net link
 * (universal links on iOS, app links on Android) or a maw3ed:// one —
 * passes through here before Expo Router looks for a matching file.
 *
 * Website paths do not match app files (/dashboard/bookings is
 * /(business)/calendar here), so they are translated by lib/links.ts.
 * Anything not ours, or not yet in the app, lands on the home gate
 * rather than on a not-found screen.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    return routeFor(path);
  } catch {
    return "/";
  }
}
