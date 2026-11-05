import { cookies } from "next/headers";
import { decode } from "next-auth/jwt";
import { db } from "@/lib/db";

/**
 * Who the browser finishing a Google sign-in is already signed in as.
 *
 * Why it matters: when a Google sign-in arrives with a session cookie,
 * NextAuth links the Google account to whoever that cookie names
 * (@auth/core handle-login: `if (user) linkAccount({ …, userId: user.id })`),
 * checking only that the user exists: not our revocation, not whether
 * the person at the keyboard is that user. On a shared computer somebody
 * could attach their own Google account to the account left signed in,
 * and with a stolen cookie somebody could do it after the owner signed
 * out everywhere. lib/auth/google-signin.ts refuses both.
 *
 * Mirrors how NextAuth reads the cookie (either name, chunks joined in
 * order, the cookie name as the salt), so it judges the same token
 * NextAuth would link to. A cookie it cannot read, or one naming a user
 * who no longer exists, names nobody, for NextAuth as for this.
 */
const NAMES = ["__Secure-authjs.session-token", "authjs.session-token"];

export async function sessionCookieUser(): Promise<string | null> {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) return null;

  const all = (await cookies()).getAll();
  for (const name of NAMES) {
    const value = sessionCookieValue(all, name);
    if (!value) continue;

    const token = await decode({ token: value, secret, salt: name }).catch(() => null);
    const sub = typeof token?.sub === "string" ? token.sub : null;
    if (!sub) continue;

    const user = await db.user.findUnique({ where: { id: sub }, select: { id: true } });
    if (user) return user.id;
  }
  return null;
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

/**
 * Where the sign-in was going (NextAuth's callback-url cookie, set from
 * signIn()'s redirectTo), as a path, or null.
 */
export async function signInDestination(): Promise<string | null> {
  const jar = await cookies();
  const raw = jar.get("__Secure-authjs.callback-url")?.value ?? jar.get("authjs.callback-url")?.value;
  if (!raw) return null;
  try {
    return new URL(raw, "http://x").pathname;
  } catch {
    return null;
  }
}
