import { createHmac } from "crypto";

/**
 * A stable, keyed pseudonym for a value we need to recognise again but
 * must not store: a phone number whose account was deleted, kept only
 * so the next account on that number is not shown the old history.
 *
 * HMAC-SHA256 under PSEUDONYM_SECRET, so the table holds opaque strings:
 * without the key they cannot be reversed or checked against a guess.
 *
 * Its own secret, not AUTH_SECRET: the signing secret is rotated when
 * it leaks (every session ends, nothing else is lost), but these rows
 * are permanent and the plaintext is gone, so a key change here would
 * silently drop the fence for every number released before it. This
 * key is therefore NOT rotated in the ordinary way; if it must be, the
 * runbook's re-hash plan does not exist and every PhoneRelease row
 * would have to be accepted as lost (docs/runbooks/SECURITY_OPERATIONS.md § 1).
 *
 * Falls back to the signing secret only where PSEUDONYM_SECRET is unset
 * (local development, tests); production must set it before this code
 * deploys and never change it.
 */
export function pseudonym(value: string): string {
  const secret = process.env.PSEUDONYM_SECRET || process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "";
  return createHmac("sha256", secret).update(value).digest("hex");
}
