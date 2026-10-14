import { useEffect, useRef, useState } from "react";
import { router, usePathname, useSegments } from "expo-router";
import { useAuth } from "./AuthProvider";
import { signInThenReturn } from "./AuthShell";

/** The sign-in screens, whose paths carry no group. */
const AUTH_PATHS = new Set(["/login", "/verify", "/profile"]);

/**
 * The door to a part of the app that needs an account, for screens that
 * can be reached by a link.
 *
 * Arrived signed out (a shared link, a notification after the session
 * ended): sign in — once — then come back to the same screen. Signed out
 * from inside: that is leaving, so "left" and the caller goes home.
 * Closed the sign-in screen without signing in: home too, never a blank
 * screen waiting for a sign-in that is not coming.
 */
export function useSignedInGuard(): "wait" | "left" | "in" {
  const { user, restoring } = useAuth();
  const pathname = usePathname();
  const segments = useSegments();

  // Whether this screen has had a signed-in person, kept as state and
  // updated during render (React's pattern for state derived from props).
  const [seen, setSeen] = useState(false);
  if (user && !seen) setSeen(true);

  // The path to come back to, with its group: "/notifications" exists in
  // both the customer and the business tabs, and without "(business)" the
  // return could land in the wrong one.
  const group = segments[0]?.startsWith("(") ? `/${segments[0]}` : "";
  const back = group && !pathname.startsWith(group) ? `${group}${pathname === "/" ? "" : pathname}` : pathname;

  // Once per visit. Opening sign-in changes the path to /login while this
  // screen stays mounted underneath; asking again would stack sign-in
  // screens and remember /login as the place to come back to.
  const asked = useRef(false);
  useEffect(() => {
    if (user) {
      asked.current = false;
      return;
    }
    if (restoring || seen) return;
    if (!asked.current) {
      asked.current = true;
      signInThenReturn(back);
    } else if (!AUTH_PATHS.has(pathname)) {
      // Back here without an account: sign-in was closed. Home.
      router.replace("/");
    }
  }, [restoring, user, seen, pathname, back]);

  if (restoring) return "wait";
  if (!user) return seen ? "left" : "wait";
  return "in";
}
