import { log } from "@/lib/logger";

/**
 * Sending to phones through Expo's push service.
 *
 * Expo holds the platform credentials — the APNs key for iOS and the
 * FCM service account for Android are uploaded to the EAS project (see
 * docs/push-setup.md) — so the server sends one request to Expo per batch
 * and Expo talks to Apple and Google. EXPO_ACCESS_TOKEN is optional: when
 * set, Expo refuses pushes that do not carry it ("enhanced security"),
 * which is what production should use.
 *
 * Retries are here, not in the caller: a 429 or a 5xx from Expo is
 * retried twice with a short backoff; a per-device error comes back in
 * that device's ticket and is not retried — DeviceNotRegistered means the
 * app was uninstalled or the token rotated, and sending again is noise.
 */

const ENDPOINT = "https://exp.host/--/api/v2/push/send";
/** Expo accepts at most 100 messages per request. */
const BATCH = 100;
const RETRIES = 2;

export interface PushMessage {
  to: string;
  title: string;
  body?: string;
  /** Only what the app needs to route a tap — never personal data or secrets. */
  data?: Record<string, string>;
  /** Android notification channel; the app creates "default". */
  channelId?: string;
  sound?: "default" | null;
  priority?: "default" | "normal" | "high";
  badge?: number;
}

export type PushTicket =
  | { status: "ok"; id: string }
  | { status: "error"; message: string; details?: { error?: string } };

export interface PushResult {
  /** One per message, in order; null when the whole request failed. */
  tickets: (PushTicket | null)[];
  /** Tokens Expo says are dead, for the caller to disable. */
  deadTokens: string[];
}

export function isExpoToken(token: string): boolean {
  return /^Expo(nent)?PushToken\[[^\]]+\]$/.test(token);
}

type Fetch = typeof fetch;

export async function sendExpoPush(messages: PushMessage[], doFetch: Fetch = fetch, wait = sleep): Promise<PushResult> {
  const tickets: (PushTicket | null)[] = [];
  const deadTokens: string[] = [];

  for (let i = 0; i < messages.length; i += BATCH) {
    const batch = messages.slice(i, i + BATCH);
    const answer = await postWithRetry(batch, doFetch, wait);
    batch.forEach((m, j) => {
      const ticket = answer?.[j] ?? null;
      tickets.push(ticket);
      if (ticket?.status === "error" && ticket.details?.error === "DeviceNotRegistered") deadTokens.push(m.to);
    });
  }

  return { tickets, deadTokens };
}

async function postWithRetry(batch: PushMessage[], doFetch: Fetch, wait: (ms: number) => Promise<void>): Promise<PushTicket[] | null> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "Accept-Encoding": "gzip, deflate",
  };
  const token = process.env.EXPO_ACCESS_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;

  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    try {
      const res = await doFetch(ENDPOINT, { method: "POST", headers, body: JSON.stringify(batch) });
      if (res.status === 429 || res.status >= 500) {
        log.warn(`[push] expo returned ${res.status}, attempt ${attempt + 1}`);
        if (attempt < RETRIES) await wait(500 * 2 ** attempt);
        continue;
      }
      const json = (await res.json().catch(() => null)) as { data?: PushTicket[]; errors?: unknown } | null;
      if (!res.ok || !json?.data) {
        log.error(`[push] expo refused the request (${res.status})`, json?.errors ?? null);
        return null;
      }
      return json.data;
    } catch (e) {
      log.warn("[push] network error talking to expo", { error: e instanceof Error ? e.message : String(e) });
      if (attempt < RETRIES) await wait(500 * 2 ** attempt);
    }
  }
  return null;
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}
