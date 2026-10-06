import { randomInt } from "crypto";

/**
 * The booking reference a customer reads down the phone.
 *
 * MWD-7F92K. Five characters from an alphabet with no 0, O, 1, I or L,
 * so the pairs people routinely mishear or mistype cannot occur. 31^5 is
 * about 28.6 million, which is ample for a platform where the reference
 * is a lookup key and never a secret — the access token is what
 * authorises anything.
 */

/** No 0/O, no 1/I/L. Also used by the migration that backfilled old rows. */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const LENGTH = 5;
export const REFERENCE_PREFIX = "MWD-";

export function generateReference(): string {
  let out = REFERENCE_PREFIX;
  for (let i = 0; i < LENGTH; i++) {
    // randomInt, not Math.random: a reference that can be guessed in
    // sequence invites people to go looking at other people's bookings.
    out += ALPHABET[randomInt(ALPHABET.length)];
  }
  return out;
}

const PATTERN = new RegExp(`^${REFERENCE_PREFIX}[${ALPHABET}]{${LENGTH}}$`);

export function isValidReference(value: string): boolean {
  return PATTERN.test(value);
}

/**
 * Accepts what a person actually types: lower case, missing dash,
 * surrounding spaces. Returns null when it cannot be read as one.
 */
export function normaliseReference(raw: string): string | null {
  const cleaned = raw.trim().toUpperCase().replace(/\s+/g, "");
  const body = cleaned.startsWith(REFERENCE_PREFIX)
    ? cleaned.slice(REFERENCE_PREFIX.length)
    : cleaned.startsWith("MWD")
      ? cleaned.slice(3)
      : cleaned;

  const candidate = REFERENCE_PREFIX + body;
  return isValidReference(candidate) ? candidate : null;
}
