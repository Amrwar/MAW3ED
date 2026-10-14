import { useEffect, useRef, useState } from "react";
import { usePathname } from "expo-router";
import { useAuth } from "./AuthProvider";
import { signInThenReturn } from "./AuthShell";

/**
 * The door to a part of the app that needs an account, for screens that
 * can be reached by a link.
 *
 * Arrived signed out (a shared link, a notification after the session
 * ended): sign in, then come back to the same screen. Signed out from
 * inside: that is leaving, so "left" — the caller goes home, never to the
 * sign-in page.
 */
export function useSignedInGuard(): "wait" | "left" | "in" {
  const { user, restoring } = useAuth();
  const pathname = usePathname();
  // Whether this screen has had a signed-in person, kept as state and
  // updated during render (React's pattern for state derived from props).
  const [seen, setSeen] = useState(false);
  if (user && !seen) setSeen(true);

  // Once per visit. Opening sign-in changes the path to /login while this
  // screen stays mounted underneath; asking again would stack sign-in
  // screens and remember /login as the place to come back to.
  const asked = useRef(false);
  useEffect(() => {
    if (user) {
      asked.current = false;
      return;
    }
    if (!restoring && !seen && !asked.current) {
      asked.current = true;
      signInThenReturn(pathname);
    }
  }, [restoring, user, seen, pathname]);

  if (restoring) return "wait";
  if (!user) return seen ? "left" : "wait";
  return "in";
}
