import { cookies } from "next/headers";
import { decode } from "next-auth/jwt";
import { db } from "@/lib/db";
import { sessionRevoked } from "@/lib/security/session-policy";

/**
 * Whether the browser finishing a Google sign-in still carries a web
 * session that has been revoked.
 *
 * Why it matters: when a Google sign-in arrives with a session cookie,
 * NextAuth links the Google account to whoever that cookie names
 * (@auth/core handle-login), checking only that the user exists. It does
 * not know about our revocation (sessionsRevokedAt, set by a password
 * reset and "sign out everywhere"). Somebody holding a stolen cookie
 * after the owner signed out everywhere could otherwise attach their own
 * Google account to the owner's and walk back in with a fresh session.
 *
 * A legitimate visitor rarely hits this: the page they press the button
 * on fetches /api/auth/session, which already clears a revoked cookie.
 *
 * Mirrors how NextAuth reads the cookie (either name, chunks joined in
 * order, the cookie name as the salt), so it judges the same token
 * NextAuth would link to.
 */
const NAMES = ["__Secure-authjs.session-token", "authjs.session-token"];

export async function carriesRevokedSession(): Promise<boolean> {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) return false;

  const jar = await cookies();
  const all = jar.getAll();

  for (const name of NAMES) {
    const value = sessionCookieValue(all, name);
    if (!value) continue;

    const token = await decode({ token: value, secret, salt: name }).catch(() => null);
    const sub = typeof token?.sub === "string" ? token.sub : null;
    if (!sub) continue;

    const user = await db.user.findUnique({ where: { id: sub }, select: { sessionsRevokedAt: true } });
    if (user && sessionRevoked(token?.signedInAt as number | undefined, user.sessionsRevokedAt)) return true;
  }
  return false;
}

/** The cookie under `name`, or its chunks `name.0`, `name.1`… joined. */
export function sessionCookieValue(all: { name: string; value: string }[], name: string): string | null {
  const whole = all.find((c) => c.name === name);
  if (whole) return whole.value;
  const chunks = all
    .map((c) => ({ c, m: c.name.startsWith(`${name}.`) ? /^\d+$/.exec(c.name.slice(name.length + 1)) : null }))
    .filter((x) => x.m)
    .sort((a, b) => Number(a.m![0]) - Number(b.m![0]))
    .map((x) => x.c.value);
  return chunks.length ? chunks.join("") : null;
}
