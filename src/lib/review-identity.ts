import { createHash, randomBytes } from "crypto";

/**
 * Who voted, without knowing who voted.
 *
 * A helpful vote and a report both need to be one-per-person, which
 * means storing something per person. What is stored is a hash of a
 * random id the browser keeps, salted with the server's secret and with
 * the review's own id.
 *
 * Including the review id in the hash is the part that matters: it
 * means two rows for the same device have different hashes, so the
 * table cannot be read as "this person looked at these fourteen
 * reviews". Each row answers one question — has this device already
 * voted on *this* review — and nothing else.
 *
 * It is not proof of identity and does not pretend to be. Somebody who
 * clears their storage votes again. It stops the accidental double-tap
 * and the casual refresh, which is what it is for; a determined
 * attacker needs rate limiting, which the endpoints also do.
 */

const SALT = process.env.AUTH_SECRET ?? "maw3ed-dev-salt";

/** The cookie the browser keeps its random id in. */
export const DEVICE_COOKIE = "mw_d";

export function newDeviceId(): string {
  return randomBytes(16).toString("hex");
}

/** A device id is only ever 32 hex characters; anything else is junk. */
export function isDeviceId(v: string | undefined | null): v is string {
  return typeof v === "string" && /^[0-9a-f]{32}$/.test(v);
}

export function voterHash(deviceId: string, reviewId: string): string {
  return createHash("sha256").update(`${SALT}:${reviewId}:${deviceId}`).digest("hex");
}

/**
 * For rate limiting, where the point is to recognise one person across
 * several reviews — the opposite of the above, so it is a separate
 * function with a separate name rather than a flag on the first.
 */
export function reporterScopeHash(deviceId: string): string {
  return createHash("sha256").update(`${SALT}:reporter:${deviceId}`).digest("hex");
}
