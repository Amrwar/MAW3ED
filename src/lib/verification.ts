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

/**
 * Normalises an Egyptian mobile number to E.164 (20XXXXXXXXXX).
 * Accepts 01XXXXXXXXX, 201XXXXXXXXX, +201XXXXXXXXX and spaced forms.
 * Returns null when the number is not a valid Egyptian mobile.
 */
export function normaliseEgyptianMobile(input: string): string | null {
  const digits = input.replace(/\D/g, "");

  let local: string;
  if (digits.startsWith("20") && digits.length === 12) local = digits.slice(2);
  else if (digits.startsWith("0") && digits.length === 11) local = digits.slice(1);
  else if (digits.length === 10) local = digits;
  else return null;

  // Egyptian mobiles are 1 followed by 0, 1, 2 or 5, then eight digits.
  if (!/^1[0125]\d{8}$/.test(local)) return null;

  return `20${local}`;
}

/** "20101…" → "+20 10 1234 5678", for showing the number back to the user. */
export function formatEgyptianMobile(e164: string): string {
  const local = e164.startsWith("20") ? e164.slice(2) : e164;
  if (local.length !== 10) return e164;
  return `+20 ${local.slice(0, 2)} ${local.slice(2, 6)} ${local.slice(6)}`;
}

/* ─── Earning the verified badge ─────────────────────────── */

export interface VerificationState {
  emailVerified: boolean;
  phoneVerified: boolean;
  hasServices: boolean;
  hasProfile: boolean;
}

/**
 * The "موثّق" badge on a business page.
 *
 * It used to be a column nothing ever wrote, so it was permanently
 * false for every business — a trust signal that could not be earned
 * and therefore told a customer nothing. It is now derived: the owner
 * proved their email and their WhatsApp number, and the listing is
 * complete enough to book from.
 */
export function qualifiesAsVerified(state: VerificationState): boolean {
  return (
    state.emailVerified && state.phoneVerified && state.hasServices && state.hasProfile
  );
}
