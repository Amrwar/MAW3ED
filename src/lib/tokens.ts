import { randomBytes } from "crypto";

/**
 * An unguessable token for links and invitations: cryptographic
 * randomness, URL-safe, never derived from an id or anything a person
 * could enumerate.
 */
export function randomToken(bytes = 24): string {
  return randomBytes(bytes).toString("base64url");
}
