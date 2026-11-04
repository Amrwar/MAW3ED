import { createHash, randomBytes, timingSafeEqual } from "crypto";

/**
 * API keys: "mw_<prefix>_<secret>". The prefix (12 base32-ish characters)
 * finds the client; the whole key's SHA-256 is what is stored and compared.
 * A key is 192 bits of randomness, so a fast hash is the right choice —
 * there is nothing to brute-force that a slow hash would protect.
 */

const KEY_RE = /^mw_([a-z0-9]{12})_([A-Za-z0-9_-]{32})$/;

export function newApiKey(): { key: string; prefix: string; hash: string } {
  const prefix = randomBytes(9).toString("base64url").toLowerCase().replace(/[^a-z0-9]/g, "").padEnd(12, "0").slice(0, 12);
  const secret = randomBytes(24).toString("base64url");
  const key = `mw_${prefix}_${secret}`;
  return { key, prefix: `mw_${prefix}`, hash: hashKey(key) };
}

export function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/** The client prefix of a well-formed key; null for anything else. */
export function prefixOf(key: string): string | null {
  const m = KEY_RE.exec(key);
  return m ? `mw_${m[1]}` : null;
}

/** Constant-time: does this key hash to the stored hash? */
export function keyMatches(key: string, storedHash: string): boolean {
  const a = Buffer.from(hashKey(key), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
