import { randomBytes, randomInt, createHash, timingSafeEqual } from "crypto";

/**
 * Shared primitives for the two verification flows.
 *
 * Both store only a hash. A read of the database must not let anyone
 * verify an address or a number they do not control — which is also
 * why the existing PasswordResetToken table, which keeps its token in
 * plaintext, is worth revisiting.
 */

/* ─── Email tokens ───────────────────────────────────────── */

/** How long a verification link stays usable. */
export const EMAIL_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

/** Shortest gap between two verification emails to one account. */
export const EMAIL_RESEND_COOLDOWN_MS = 60 * 1000;

export function generateEmailToken(): string {
  return randomBytes(32).toString("hex");
}

/* ─── Phone codes ────────────────────────────────────────── */

/** Codes are short because they are typed by hand from a phone. */
export const PHONE_CODE_LENGTH = 6;

/** Short life, because a code is read and typed within a minute. */
export const PHONE_CODE_TTL_MS = 10 * 60 * 1000;

/** Wrong guesses allowed before the code is burned. */
export const PHONE_MAX_ATTEMPTS = 5;

/** Shortest gap between two codes to the same business. */
export const PHONE_RESEND_COOLDOWN_MS = 60 * 1000;

/**
 * A six-digit code from a cryptographically secure source.
 * `Math.random()` is not acceptable here — the code is a credential.
 */
export function generatePhoneCode(): string {
  const max = 10 ** PHONE_CODE_LENGTH;
  return String(randomInt(0, max)).padStart(PHONE_CODE_LENGTH, "0");
}

/* ─── Hashing ────────────────────────────────────────────── */

/**
 * Tokens and codes are high-entropy and single-use, so a fast digest is
 * the right tool: there is nothing to brute-force offline, and bcrypt
 * would add latency to every check for no gain.
 */
export function hashSecret(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Constant-time comparison, so a wrong code cannot be timed out. */
export function secretMatches(candidate: string, storedHash: string): boolean {
  const a = Buffer.from(hashSecret(candidate), "hex");
  const b = Buffer.from(storedHash, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function isExpired(expiresAt: Date, now = Date.now()): boolean {
  return expiresAt.getTime() <= now;
}

export function cooledDown(lastSentAt: Date, cooldownMs: number, now = Date.now()): boolean {
  return now - lastSentAt.getTime() >= cooldownMs;
}

/* ─── Phone numbers ──────────────────────────────────────── */

// Normalising and formatting numbers from any country: src/lib/phone.ts.

/* The public verified badge follows identity verification by an
   administrator; see lib/business-verification.ts. */

