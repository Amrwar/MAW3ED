import { createHmac } from "crypto";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { log } from "@/lib/logger";

/**
 * Rate limiting that survives being deployed serverlessly.
 *
 * An in-memory counter is useless here. Vercel runs many instances and
 * recycles them; a Map would let an attacker get `limit` attempts per
 * instance per cold start, which is not a limit at all. So the counter
 * lives in Postgres, which every instance already shares.
 *
 * It is a fixed window rather than a sliding one. A sliding window is
 * more precise and needs a row per attempt; a fixed window needs one
 * row per window and the worst case — twice the limit across a window
 * boundary — is irrelevant when the limit is five logins in fifteen
 * minutes.
 *
 * What is stored is a hash, never the thing hashed. The key for an IP
 * is HMAC(ip) under AUTH_SECRET, so the table holds opaque strings
 * that expire in minutes, and somebody reading it learns neither who
 * tried nor from where. That matters here for the same reason it
 * mattered for ProfileView: data that is not collected cannot leak.
 */

export interface RateLimitRule {
  /** How many attempts the window allows. */
  limit: number;
  /** How long the window lasts. */
  windowSeconds: number;
}

export interface RateLimitResult {
  ok: boolean;
  /** Attempts left in this window; 0 once blocked. */
  remaining: number;
  /** Seconds until the window resets, for Retry-After. */
  retryAfter: number;
}

/**
 * The rules, in one place so they can be read together.
 *
 * Login is the tightest: it is the only one where guessing right ends
 * with somebody else's account. The others are throttled mainly to stop
 * an endpoint being used to send mail or SMS at somebody.
 */
export const RULES = {
  login: { limit: 8, windowSeconds: 15 * 60 },
  signup: { limit: 5, windowSeconds: 60 * 60 },
  forgotPassword: { limit: 5, windowSeconds: 60 * 60 },
  resetPassword: { limit: 8, windowSeconds: 60 * 60 },
  verifyEmail: { limit: 5, windowSeconds: 60 * 60 },
  phoneOtp: { limit: 5, windowSeconds: 60 * 60 },
  mobileRefresh: { limit: 60, windowSeconds: 60 * 60 },
} as const satisfies Record<string, RateLimitRule>;

export type Bucket = keyof typeof RULES;

function hashIdentifier(value: string): string {
  const secret = process.env.AUTH_SECRET ?? "";
  // Without a secret the hash is still a hash, just not keyed. Better
  // than storing the raw value, and AUTH_SECRET is required in any
  // deployment that can sign in at all.
  return createHmac("sha256", secret).update(value).digest("hex").slice(0, 32);
}

/**
 * The caller's address, as the proxy reports it.
 *
 * x-forwarded-for is a client-supplied header everywhere except behind
 * a proxy that overwrites it — which Vercel does. The LAST entry is the
 * one Vercel appended and the only one worth trusting; the earlier ones
 * can be anything the client typed. Taking the first, which is the
 * common mistake, lets an attacker rotate the header and get a fresh
 * budget per request.
 */
async function callerKey(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded.split(",").map((p) => p.trim()).filter(Boolean);
    const last = parts[parts.length - 1];
    if (last) return last;
  }
  return h.get("x-real-ip") ?? "unknown";
}

/**
 * Count one attempt against a bucket.
 *
 * `identifier` narrows the bucket beyond the caller's address — an
 * email on login, so somebody rotating IP addresses still cannot grind
 * one account, and somebody behind a shared office NAT is not locked
 * out because a colleague mistyped their password.
 *
 * Fails OPEN. If the database is unreachable the request is allowed:
 * a limiter that takes the site down when it cannot count has caused a
 * worse outage than the one it was guarding against.
 */
export async function rateLimit(
  bucket: Bucket,
  identifier?: string | null,
): Promise<RateLimitResult> {
  const rule = RULES[bucket];
  const now = Date.now();
  const windowMs = rule.windowSeconds * 1000;
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const expiresAt = new Date(windowStart + windowMs);

  const subject = identifier?.trim().toLowerCase() || (await callerKey());
  const key = `${bucket}:${hashIdentifier(subject)}:${windowStart}`;

  try {
    // One statement: insert the row or increment it, and return the new
    // value. Reading then writing would let two requests land on the
    // same count and both be allowed through on the last attempt.
    const rows = await db.$queryRaw<{ count: number }[]>`
      INSERT INTO "RateLimit" ("key", "count", "expiresAt")
      VALUES (${key}, 1, ${expiresAt})
      ON CONFLICT ("key") DO UPDATE SET "count" = "RateLimit"."count" + 1
      RETURNING "count"`;

    const count = rows[0]?.count ?? 1;
    const remaining = Math.max(0, rule.limit - count);
    const retryAfter = Math.max(1, Math.ceil((windowStart + windowMs - now) / 1000));

    return { ok: count <= rule.limit, remaining, retryAfter };
  } catch (e) {
    log.error("[rate-limit] counter unavailable, allowing request", e);
    return { ok: true, remaining: rule.limit, retryAfter: 0 };
  }
}

/**
 * The refusal.
 *
 * 429 with Retry-After, and a message that says nothing about why. "Too
 * many attempts" is the same answer whether the email exists or not, so
 * the limiter cannot be used to enumerate accounts — which would make
 * it a disclosure rather than a defence.
 */
export function tooManyRequests(result: RateLimitResult): Response {
  return Response.json(
    { error: "محاولات كتير. استنى شوية وحاول تاني." },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfter),
        "Cache-Control": "no-store",
      },
    },
  );
}

/**
 * Drop windows that have passed.
 *
 * Called from the cron that already runs, rather than on every write:
 * a delete on the hot path costs every request to save a table that
 * stays small anyway.
 */
export async function pruneRateLimits(): Promise<number> {
  const { count } = await db.rateLimit.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return count;
}
