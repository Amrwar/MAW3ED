import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Draft } from "./flow";

/**
 * A booking in progress survives the app being backgrounded, killed by
 * the system, or closed and reopened.
 *
 * Two things are kept per business:
 *
 *   the draft    the answers so far, so reopening lands where they left
 *   the attempt  the idempotency key of a submission in flight and, once
 *                the server answered, the booking's token and payment
 *                page — so a reply lost to a dropped connection is
 *                recovered with the same key rather than booked twice,
 *                and a deposit left half-paid can be finished.
 *
 * Nothing here is authoritative. A restored draft is re-checked against
 * the business (flow.reconcile) and a restored attempt against the
 * server (GET /api/public/booking/[token]). No name, phone or email is
 * stored beyond what the customer typed into this form.
 */

const PREFIX = "maw3ed.booking.";
/** Older than this, a draft is a different visit, not this one. */
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;
/** Paymob's session lasts an hour; past that a page cannot be finished. */
export const PAYMENT_TTL_MS = 60 * 60 * 1000;

export interface Attempt {
  key: string;
  /** flow.fingerprint of the body the key was minted for. */
  fp: string;
  token?: string;
  paymentUrl?: string;
  /** When the payment page was opened, for PAYMENT_TTL_MS. */
  paymentAt?: number;
}

export interface Saved {
  draft: Draft;
  attempt: Attempt | null;
  savedAt: number;
}

export async function loadSaved(slug: string, now = Date.now()): Promise<Saved | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + slug);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Saved;
    if (!saved?.draft || now - saved.savedAt > DRAFT_TTL_MS) {
      await AsyncStorage.removeItem(PREFIX + slug);
      return null;
    }
    return saved;
  } catch {
    return null;
  }
}

export async function save(slug: string, draft: Draft, attempt: Attempt | null): Promise<void> {
  try {
    await AsyncStorage.setItem(PREFIX + slug, JSON.stringify({ draft, attempt, savedAt: Date.now() } satisfies Saved));
  } catch {
    // Storage full or unavailable: the flow still works, it just will not survive a restart.
  }
}

export async function clearSaved(slug: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(PREFIX + slug);
  } catch {
    /* nothing to clear */
  }
}

/* ─── The payment page, by booking ───────────────────────── */

/**
 * The page to finish a deposit on, kept by booking token so the result
 * screen can offer "continue payment" after the app was closed.
 */
const PAY_PREFIX = "maw3ed.pay.";

export async function rememberPayment(token: string, url: string, label?: string): Promise<void> {
  try {
    await AsyncStorage.setItem(PAY_PREFIX + token, JSON.stringify({ url, at: Date.now(), label: label ?? null }));
  } catch {
    /* best effort */
  }
}

export async function paymentPage(token: string, now = Date.now()): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(PAY_PREFIX + token);
    if (!raw) return null;
    const { url, at } = JSON.parse(raw) as { url: string; at: number };
    // Past Paymob's hour the page cannot be paid; the entry stays for
    // Home's reminder, and the booking screen asks the server for a new one.
    if (now - at > PAYMENT_TTL_MS) return null;
    return url;
  } catch {
    return null;
  }
}

/**
 * Payments this device started and has not seen finish — for Home's
 * "finish your payment" reminder after the app was closed mid-payment.
 * Only a reminder: the booking screen asks the server what happened.
 */
export async function unfinishedPayments(now = Date.now()): Promise<{ token: string; label: string | null }[]> {
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(PAY_PREFIX));
    const out: { token: string; label: string | null }[] = [];
    for (const k of keys) {
      const raw = await AsyncStorage.getItem(k);
      if (!raw) continue;
      const { at, label } = JSON.parse(raw) as { at: number; label?: string | null };
      // A held booking is released after two hours; past that there is nothing to finish.
      if (now - at > 2 * 60 * 60 * 1000) {
        await AsyncStorage.removeItem(k);
        continue;
      }
      out.push({ token: k.slice(PAY_PREFIX.length), label: label ?? null });
    }
    return out;
  } catch {
    return [];
  }
}

export async function forgetPayment(token: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(PAY_PREFIX + token);
  } catch {
    /* best effort */
  }
}
