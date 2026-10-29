/**
 * How long a web session lives, and how it is ended early.
 *
 * Sessions are JSON Web Tokens in a cookie (src/auth.ts). A token is
 * valid until it expires, whatever happens to the account meanwhile —
 * which is the one thing a stateless session cannot do: be revoked.
 * So the token is checked against the database every RECHECK_MS, and
 * an account carries `sessionsRevokedAt`: every token signed in before
 * that moment is refused on its next check. A password reset sets it
 * (whoever needed the reset may be resetting because somebody else got
 * in); so does "sign out everywhere".
 *
 * The check also re-reads the business, phone and admin role, so a
 * role taken away reaches the navigation within RECHECK_MS even though
 * the guards never trusted the token for it.
 */

/** A web session's life, from sign-in. */
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/** How long a token's copy of the account facts is trusted before it is re-read. */
export const SESSION_RECHECK_MS = 5 * 60 * 1000;

/** Whether a token signed in at `signedInAt` has been revoked by a later `sessionsRevokedAt`. */
export function sessionRevoked(signedInAt: number | null | undefined, revokedAt: Date | null | undefined): boolean {
  if (!revokedAt) return false;
  // A token with no sign-in time predates this field: treated as old,
  // so a revocation after this code ships ends it too.
  if (!signedInAt) return true;
  return revokedAt.getTime() > signedInAt;
}

/** Whether the token's cached facts are old enough to re-read. */
export function needsRecheck(checkedAt: number | null | undefined, now: number = Date.now()): boolean {
  return !checkedAt || now - checkedAt > SESSION_RECHECK_MS;
}
