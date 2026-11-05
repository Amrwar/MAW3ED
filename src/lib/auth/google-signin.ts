import { db } from "@/lib/db";
import { log } from "@/lib/logger";
import { googleProfileAccepted } from "@/lib/auth/google";
import { sessionCookieUser, signInDestination } from "@/lib/auth/oauth-guard";

/**
 * The signIn callback's decision for Google (src/auth.ts).
 *
 * Returns true to go on, or the address of a page that explains the
 * refusal. Three rules:
 *
 *   1. Only an address Google has verified. With email linking on, an
 *      unverified one would hand the Maw3ed account registered under it
 *      to whoever typed it into a Google account.
 *
 *   2. Never link into the account somebody else left signed in. If the
 *      browser's session cookie names a user, NextAuth links this Google
 *      account to that user (lib/auth/oauth-guard.ts). So a sign-in with
 *      a session present is allowed only when this Google account
 *      already belongs to that same user, which links nothing. Anybody
 *      else signs out first. After the phone step merges an account away
 *      (lib/account/link-phone.ts) the cookie names a deleted user,
 *      which names nobody, so that re-sign-in goes through.
 *
 *   3. An account pre-registered under the address is not inherited as
 *      it is. Somebody could sign up with a victim's Gmail address and a
 *      password of their choosing, never verify it, and wait: the
 *      victim's first "Continue with Google" would link into that account
 *      and the squatter's password would still open it. When Google is
 *      about to be linked by email to an account whose address was never
 *      verified, that account's password is removed, its web sessions
 *      revoked and its app sessions ended first. The real owner of the
 *      address keeps the account (Google proved the address, and
 *      events.signIn marks it verified) and can set a password again
 *      through "forgot password", which mails that address. A verified
 *      account is linked as it is: its owner proved the address already.
 */
export type GoogleRefusal = "EmailUnverified" | "SignedIn";

export async function decideGoogleSignIn(
  account: { providerAccountId: string },
  profile: { email?: string | null; email_verified?: unknown } | null | undefined,
): Promise<true | string> {
  if (!googleProfileAccepted(profile)) {
    log.warn("[auth] Google sign-in refused: email not verified");
    return refusal("EmailUnverified");
  }
  const email = String(profile!.email).trim().toLowerCase();

  const linked = await db.account.findUnique({
    where: { provider_providerAccountId: { provider: "google", providerAccountId: account.providerAccountId } },
    select: { userId: true },
  });

  const current = await sessionCookieUser();
  if (current && current !== linked?.userId) {
    log.warn("[auth] Google sign-in refused: another account is signed in in this browser");
    return refusal("SignedIn");
  }

  if (!linked) await disarmUnverifiedAccount(email);
  return true;
}

/** Rule 3: an unverified account about to be linked by its address. */
async function disarmUnverifiedAccount(email: string): Promise<void> {
  const existing = await db.user.findUnique({ where: { email }, select: { id: true, emailVerified: true } });
  if (!existing || existing.emailVerified) return;

  // Revoked "now": the Google session minted right after this records
  // its own start a moment later, so it is the one session that lives.
  await db.$transaction([
    db.user.update({ where: { id: existing.id }, data: { password: null, sessionsRevokedAt: new Date() } }),
    db.mobileSession.deleteMany({ where: { userId: existing.id } }),
  ]);
  log.warn("[auth] Google linked to an unverified account: password removed, sessions revoked", { userId: existing.id });
}

/**
 * The page that explains a refusal: the customer sign-in when that is
 * where the sign-in started (it was heading for the account area), the
 * business sign-in otherwise.
 */
async function refusal(code: GoogleRefusal): Promise<string> {
  const to = (await signInDestination()) ?? "";
  const bare = to.replace(/^\/en(?=\/|$)/, "");
  const customer = bare === "/account" || bare.startsWith("/account/") || bare === "/notifications";
  return `${customer ? "/account-login" : "/login"}?error=${code}`;
}
