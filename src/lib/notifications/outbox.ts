import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { log } from "@/lib/logger";
import type { NotificationEvent } from "./events";

/**
 * The notification ledger as an outbox.
 *
 * A row in NotificationDelivery used to be written as SENT before the
 * provider was asked, by a call nobody awaited. A function frozen by
 * the platform mid-send, a provider outage, or a WhatsApp 5xx all left
 * a row saying "sent" for a message that never left
 * (docs/audits/CRITICAL_FINDINGS.md, P17-11).
 *
 * Now a row is claimed PENDING, moved to SENT, SKIPPED or FAILED when
 * the provider answers, and carries the event it was claimed for. This
 * module is the other half: which failures are worth retrying, how long
 * to wait, when to give up (DEAD), and the job that picks up what is
 * due and hands it back to the dispatcher — which re-claims exactly the
 * rows that failed and sends only those. Nothing here composes a
 * message or chooses a recipient; that stays in dispatch.ts.
 */

/** Sends in total, the first included, before a row is given up on. */
export const MAX_ATTEMPTS = 5;

/**
 * A PENDING row older than this was claimed by a process that never
 * reported back. A send takes seconds; five minutes is generous.
 */
export const STALE_PENDING_MS = 5 * 60_000;

/** After the n-th failed attempt (1-based), wait this long before the next. */
const BACKOFF_MS = [2 * 60_000, 10 * 60_000, 30 * 60_000, 2 * 3_600_000];

/** When the next attempt may run after `attempts` sends have failed, or null to stop. */
export function nextAttemptAt(attempts: number, now: Date): Date | null {
  if (attempts >= MAX_ATTEMPTS) return null;
  const wait = BACKOFF_MS[Math.min(attempts, BACKOFF_MS.length) - 1] ?? BACKOFF_MS[BACKOFF_MS.length - 1];
  return new Date(now.getTime() + wait);
}

/**
 * A failure that will not get better by trying again: the address is
 * unusable or the provider turned the message itself away. 429 and
 * every 5xx are the provider's problem and are retried; so is a network
 * failure, and anything unrecognised — a false "permanent" loses a
 * message, a false "transient" costs a few retries.
 */
export function isPermanentFailure(reason: string | undefined): boolean {
  if (!reason) return false;
  if (reason === "device-not-registered" || reason === "invalid-phone" || reason === "no-address") return true;
  const m = /^http-(\d{3})$/.exec(reason);
  if (m) {
    const code = Number(m[1]);
    return code >= 400 && code < 500 && code !== 408 && code !== 429;
  }
  return false;
}

/**
 * A message that has stopped being worth sending. A reminder for an
 * appointment that began an hour ago would only confuse; everything
 * else — a confirmation, a cancellation, a receipt — is still news
 * however late it arrives.
 */
export function isStaleEvent(event: NotificationEvent, now: Date): boolean {
  if (event.type !== "booking.reminder" && event.type !== "booking.startingSoon") return false;
  if (!event.startsAt) return false;
  // startsAt is in the wall-clock frame (lib/bookings/instants); so is
  // the comparison, made by the caller passing a wall-clock `now`.
  return new Date(event.startsAt).getTime() < now.getTime() - 60 * 60_000;
}

/** The event as the row stores it. Dates become strings; nothing else changes. */
export function serializeEvent(event: NotificationEvent): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(event)) as Prisma.InputJsonValue;
}

/** The stored event back as one the dispatcher accepts, or null if it is not one. */
export function reviveEvent(raw: unknown): NotificationEvent | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const e = raw as Record<string, unknown>;
  if (typeof e.type !== "string") return null;
  if (e.type === "subscription.renewed" && typeof e.until === "string") {
    return { ...e, until: new Date(e.until) } as unknown as NotificationEvent;
  }
  return e as unknown as NotificationEvent;
}

export interface RedriveResult {
  /** Rows that were due. */
  due: number;
  /** Distinct events handed back to the dispatcher. */
  events: number;
  /** Rows that came back SENT this time. */
  sent: number;
  /** Rows marked DEAD here because the message had gone stale. */
  staled: number;
  /** Rows marked DEAD here because nothing can retry them (no stored event). */
  orphaned: number;
}

/**
 * Picks up every delivery that is due another go and sends it.
 *
 * Due means: FAILED with a nextAttemptAt in the past, or PENDING for
 * longer than a send could take (the process died). Each distinct
 * event is handed to `notify`, whose claim logic takes over exactly
 * the rows in those states and leaves the SENT ones alone — so a
 * retry can never send a second copy of what already arrived.
 *
 * `wallNow` is the moment in the wall-clock frame reminders are
 * compared in (cairoWallClock), for the staleness check only.
 */
export async function redriveNotifications(
  notify: (event: NotificationEvent) => Promise<{ status: string }[]>,
  now: Date = new Date(),
  wallNow: Date = now,
  limit = 200,
): Promise<RedriveResult> {
  const stale = new Date(now.getTime() - STALE_PENDING_MS);
  const rows = await db.notificationDelivery.findMany({
    where: {
      OR: [
        { status: "FAILED", nextAttemptAt: { lte: now } },
        { status: "PENDING", updatedAt: { lt: stale } },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true, dedupeKey: true, event: true, attempts: true },
  });

  const result: RedriveResult = { due: rows.length, events: 0, sent: 0, staled: 0, orphaned: 0 };
  if (rows.length === 0) return result;

  // One send per distinct event, however many of its rows are due: the
  // dispatcher claims each (audience, channel) row on its own.
  const byEvent = new Map<string, { event: NotificationEvent; ids: string[] }>();
  for (const row of rows) {
    const event = reviveEvent(row.event);
    if (!event) {
      // Written before the outbox existed; there is nothing to resend
      // from. Closed so it stops being counted as due.
      await db.notificationDelivery.update({
        where: { id: row.id },
        data: { status: "DEAD", error: "no stored event to retry from", nextAttemptAt: null },
      });
      result.orphaned++;
      continue;
    }
    const key = JSON.stringify(row.event);
    const entry = byEvent.get(key) ?? { event, ids: [] };
    entry.ids.push(row.id);
    byEvent.set(key, entry);
  }

  for (const { event, ids } of byEvent.values()) {
    if (isStaleEvent(event, wallNow)) {
      const { count } = await db.notificationDelivery.updateMany({
        where: { id: { in: ids }, status: { in: ["FAILED", "PENDING"] } },
        data: { status: "DEAD", error: "stale: the appointment has started", nextAttemptAt: null },
      });
      result.staled += count;
      continue;
    }
    result.events++;
    try {
      const outcomes = await notify(event);
      result.sent += outcomes.filter((o) => o.status === "SENT").length;
    } catch (e) {
      log.error("[notifications] re-drive failed for an event", { type: event.type, e });
    }

    // A row the dispatcher did not take over is one it will never take
    // over: the booking is gone, the recipient has switched the channel
    // off or lost their address, the staff member was removed. Left as
    // it was, it would be due on every pass and, oldest first, would in
    // time fill the batch so nothing newer was ever retried. It is
    // closed here. A row that was claimed is PENDING with a fresh
    // updatedAt, or FAILED again with a retry time in the future, and
    // matches neither condition.
    const { count } = await db.notificationDelivery.updateMany({
      where: {
        id: { in: ids },
        OR: [
          { status: "FAILED", nextAttemptAt: { lte: now } },
          { status: "PENDING", updatedAt: { lt: stale } },
        ],
      },
      data: { status: "DEAD", error: "no longer deliverable: subject or recipient gone", nextAttemptAt: null },
    });
    result.orphaned += count;
  }

  if (result.due > 0) log.info("[notifications] re-drive", { ...result });
  return result;
}
