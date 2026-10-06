/**
 * What happened when a message was handed to a provider.
 *
 * The senders have always logged their failures and returned nothing,
 * which is fine for fire-and-forget but means the notification ledger
 * cannot tell "delivered" from "the token expired three weeks ago".
 * They return this now instead. Nothing about their behaviour changed:
 * they still never throw, and a caller that ignores the result works
 * exactly as before.
 */
export type SendOutcome =
  /** Handed to the provider and accepted. */
  | { ok: true; id?: string }
  /** Nothing was attempted — no credentials, or an unusable address. */
  | { ok: false; skipped: true; reason: string }
  /** Attempted and refused, or the network failed. */
  | { ok: false; skipped?: false; reason: string };

export const sent = (id?: string): SendOutcome => ({ ok: true, id });
export const skipped = (reason: string): SendOutcome => ({ ok: false, skipped: true, reason });
export const failed = (reason: string): SendOutcome => ({ ok: false, reason });
