import { redirect } from "next/navigation";
import { auth } from "@/auth";

/**
 * Where a signed-in account belongs: an owner to the dashboard, an
 * administrator without a business to the admin, anybody else on to
 * setting up their business.
 */
export function homeFor(u: { businessId?: string | null; adminRole?: string | null } | undefined): string {
  return u?.businessId ? "/dashboard" : u?.adminRole ? "/admin" : "/onboarding";
}

/**
 * Sends a signed-in visitor of /login or /signup to their home.
 *
 * This lives in the pages, not the proxy (final audit F-27). The proxy
 * only decodes the cookie, while the pages' auth() also re-checks the
 * account against the database. After a password reset or "sign out
 * everywhere", the proxy still saw a signed-in cookie and bounced /login
 * to /dashboard, whose layout saw a revoked session and sent it back to
 * /login — a redirect loop until the browser gave up. Decided here, with
 * the same check as the dashboard, a revoked session sees the form.
 */
export async function bounceSignedIn(): Promise<void> {
  const session = await auth();
  if (session?.user?.id) redirect(homeFor(session.user));
}
