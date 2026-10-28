/**
 * The key Maw3ed signs its own tokens with (mobile sessions, booking
 * phone proofs): the secret NextAuth signs sessions with, under either of
 * the names it accepts (lib/env.ts); production has the v4 name.
 *
 * Refused rather than defaulted. A fallback secret would mean every
 * deployment that forgot to set one shares the same signing key.
 */
export function signingSecret(purpose: string): Uint8Array {
  const value = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!value) throw new Error(`AUTH_SECRET (or NEXTAUTH_SECRET) is required to sign ${purpose}`);
  return new TextEncoder().encode(value);
}
