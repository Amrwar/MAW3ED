import { createCipheriv, createDecipheriv, createHash, createHmac, hkdfSync, randomBytes, timingSafeEqual } from "crypto";

/**
 * The cryptography check-in codes and visitor passes rely on.
 *
 * - Every presentable code is 32 random bytes, or an HMAC over random
 *   bytes — never derived from a booking id, a phone number or anything
 *   guessable, and never carrying personal data.
 * - The booking check-in code is HMAC(check-in key, bookingId.nonce).
 *   The database keeps the nonce and the code's SHA-256: a copy of the
 *   database without the key cannot produce a working code.
 * - A visitor pass token the provider issued is kept as its SHA-256 and,
 *   so the holder can be shown it again, an AES-256-GCM ciphertext.
 * - Messages to and from a provider are signed with HMAC-SHA256 over
 *   `timestamp.body`, with a freshness window, so a captured message
 *   cannot be replayed later and a forged one is refused.
 *
 * Keys come from the environment, never the database. ACCESS_CREDENTIAL_KEY
 * (32 bytes, base64) is the dedicated key; without it each purpose gets
 * its own key derived from AUTH_SECRET with HKDF, so the feature works in
 * every deployment that can sign anybody in, and no two purposes share a
 * key. docs/security/VISITOR_ACCESS_THREAT_MODEL.md.
 */

export type KeyPurpose = "check-in" | "pass-at-rest" | "sandbox-webhook";

function rootKey(): Buffer | null {
  const dedicated = process.env.ACCESS_CREDENTIAL_KEY?.trim();
  if (dedicated) {
    const key = Buffer.from(dedicated, "base64");
    if (key.length === 32) return key;
  }
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  return secret ? Buffer.from(secret, "utf8") : null;
}

/** A 32-byte key for one purpose, or null when no secret is configured. */
export function purposeKey(purpose: KeyPurpose): Buffer | null {
  const root = rootKey();
  if (!root) return null;
  return Buffer.from(hkdfSync("sha256", root, Buffer.from("maw3ed-access"), Buffer.from(`v1:${purpose}`), 32));
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** The booking check-in code for this booking and nonce; null without a key. */
export function deriveCheckInCode(bookingId: string, nonce: string): string | null {
  const key = purposeKey("check-in");
  if (!key) return null;
  return createHmac("sha256", key).update(`${bookingId}.${nonce}`).digest("base64url");
}

/** Codes are 43 base64url characters; anything else is not one of ours. */
export const CODE_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/** "v1.<iv>.<tag>.<ciphertext>" in base64url, or null without a key. */
export function sealToken(token: string): string | null {
  const key = purposeKey("pass-at-rest");
  if (!key) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), ct.toString("base64url")].join(".");
}

export function openToken(sealed: string | null): string | null {
  if (!sealed) return null;
  const key = purposeKey("pass-at-rest");
  if (!key) return null;
  const [v, iv, tag, ct] = sealed.split(".");
  if (v !== "v1" || !iv || !tag || !ct) return null;
  try {
    const d = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
    d.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([d.update(Buffer.from(ct, "base64url")), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/** Seconds a signed provider message stays acceptable. */
export const SIGNATURE_TOLERANCE_SECONDS = 300;

export function signMessage(secret: string | Buffer, body: string, timestamp: number): string {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

export function verifyMessage(
  secret: string | Buffer,
  body: string,
  timestamp: number,
  signature: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  if (!secret || !secret.length || !signature || !Number.isFinite(timestamp)) return false;
  if (Math.abs(nowSeconds - timestamp) > SIGNATURE_TOLERANCE_SECONDS) return false;
  if (!/^[0-9a-f]{64}$/i.test(signature)) return false;
  const expected = Buffer.from(signMessage(secret, body, timestamp), "hex");
  const given = Buffer.from(signature, "hex");
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** Constant-time comparison of two hex digests. */
export function sameDigest(a: string, b: string): boolean {
  const x = Buffer.from(a, "hex");
  const y = Buffer.from(b, "hex");
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
}
