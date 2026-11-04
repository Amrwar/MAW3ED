import type { NotificationChannel, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { log } from "@/lib/logger";
import { sendEmail } from "@/lib/services/email";
import { notificationHtml } from "@/lib/services/email-templates";
import { isExpoToken, sendExpoPush } from "@/lib/services/expo-push";
import { failed, sent, skipped, type SendOutcome } from "@/lib/services/send-outcome";
import { MAX_ATTEMPTS, STALE_PENDING_MS, isPermanentFailure, nextAttemptAt } from "@/lib/notifications/outbox";

/**
 * Phase 27 messages to customers that are not about one booking's own
 * life: a waitlist offer, a follow-up, a nudge to book again, a renewal
 * due, points about to expire (docs/architecture/ADVANCED_BOOKING_RULES.md,
 * "Automations").
 *
 * The same ledger as every notification (NotificationDelivery): a message
 * is claimed under a unique dedupeKey before it is sent, so a cron that
 * runs twice says it once; a failure is retried on the outbox's backoff
 * and given up after MAX_ATTEMPTS. Keys start "auto:" and are re-driven
 * here, not by the booking dispatcher.
 *
 * Consent: a `marketing` message (follow-ups, rebooking nudges) goes only
 * to a customer account that switched marketing on
 * (User.marketingConsentAt), at most MARKETING_CAP_PER_WEEK per number
 * per business. A transactional one (an offer the customer asked for by
 * joining a waitlist, a membership they hold running out, points they
 * hold expiring) needs no marketing consent but still honours the
 * account's channel switches.
 */

export const MARKETING_CAP_PER_WEEK = 2;

export interface AutoMessage {
  /** Unique per message, e.g. `waitlist-offer:<entry>:<n>`. */
  key: string;
  businessId: string;
  bookingId?: string | null;
  /** The customer's number (E.164 digits): how their account is found. */
  phoneE164: string | null;
  /** An address given for this purpose (a waitlist entry's), used for a transactional message only. */
  email?: string | null;
  title: string;
  body: string;
  /** Relative path or absolute URL the message links to. */
  href: string;
  marketing: boolean;
}

type Outcome = { channel: NotificationChannel; status: string; reason?: string };

const AUTO_CHANNELS: NotificationChannel[] = ["IN_APP", "PUSH", "EMAIL"];

async function accountFor(phoneE164: string | null) {
  if (!phoneE164) return null;
  return db.user.findFirst({
    where: { phone: phoneE164, phoneVerifiedAt: { not: null } },
    select: { id: true, email: true, notifyByEmail: true, marketingConsentAt: true },
  });
}

/** Distinct marketing messages this number got from this business in the last week. */
async function marketingSentLastWeek(businessId: string, phoneE164: string, now: Date): Promise<number> {
  const rows = await db.notificationDelivery.findMany({
    where: {
      businessId,
      dedupeKey: { startsWith: `auto:mkt:${phoneE164}:` },
      createdAt: { gte: new Date(now.getTime() - 7 * 86_400_000) },
      status: { in: ["SENT", "PENDING", "FAILED"] },
    },
    select: { dedupeKey: true },
  });
  return new Set(rows.map((r) => r.dedupeKey.replace(/:(IN_APP|PUSH|EMAIL)$/, ""))).size;
}

function keyFor(m: AutoMessage, channel: NotificationChannel): string {
  return m.marketing ? `auto:mkt:${m.phoneE164}:${m.key}:${channel}` : `auto:tx:${m.key}:${channel}`;
}

/**
 * Sends one message on every channel the customer allows. Never throws.
 * Returns what happened per channel ("SKIPPED" with a reason when it was
 * not sent at all — no consent, over the cap, no address).
 */
export async function sendAutoMessage(m: AutoMessage, now: Date = new Date()): Promise<Outcome[]> {
  try {
    const user = await accountFor(m.phoneE164);
    if (m.marketing) {
      if (!user?.marketingConsentAt || !m.phoneE164) return [{ channel: "IN_APP", status: "SKIPPED", reason: "no-consent" }];
      // The cap is asked before claiming: a message already claimed (a
      // retry) is not counted against itself because its key is reused.
      const already = await db.notificationDelivery.count({ where: { dedupeKey: keyFor(m, "IN_APP") } });
      if (already === 0 && (await marketingSentLastWeek(m.businessId, m.phoneE164, now)) >= MARKETING_CAP_PER_WEEK) {
        return [{ channel: "IN_APP", status: "SKIPPED", reason: "marketing-cap" }];
      }
    }
    const out: Outcome[] = [];
    for (const channel of AUTO_CHANNELS) {
      const address =
        channel === "EMAIL"
          ? user?.email && user.notifyByEmail
            ? user.email
            : !m.marketing && !user
            ? m.email ?? null
            : null
          : user?.id ?? null;
      if (!address) {
        out.push({ channel, status: "SKIPPED", reason: "no-address" });
        continue;
      }
      out.push(await deliver(m, channel, address, user?.id ?? null, now));
    }
    return out;
  } catch (e) {
    log.error("[automations] send failed", e, { key: m.key });
    return [];
  }
}

async function deliver(m: AutoMessage, channel: NotificationChannel, address: string, userId: string | null, now: Date): Promise<Outcome> {
  const dedupeKey = keyFor(m, channel);
  const claimed = await claimRow(dedupeKey, m, channel, address, now);
  if (!claimed) return { channel, status: "DUPLICATE" };

  let outcome: SendOutcome;
  try {
    outcome = await sendOn(channel, m, address, userId);
  } catch (e) {
    log.error("[automations] channel threw", e, { channel });
    outcome = failed("channel-error");
  }
  let status: "SENT" | "SKIPPED" | "FAILED" | "DEAD" = outcome.ok ? "SENT" : outcome.skipped ? "SKIPPED" : "FAILED";
  const reason = outcome.ok ? undefined : outcome.reason;
  let retryAt: Date | null = null;
  if (status === "FAILED") {
    retryAt = isPermanentFailure(reason) ? null : nextAttemptAt(claimed.attempts, now);
    if (!retryAt) status = "DEAD";
  }
  await db.notificationDelivery
    .update({ where: { dedupeKey }, data: { status, error: reason ?? null, nextAttemptAt: retryAt } })
    .catch((e) => log.error("[automations] could not record outcome", e));
  return { channel, status, reason };
}

async function claimRow(dedupeKey: string, m: AutoMessage, channel: NotificationChannel, recipient: string, now: Date) {
  const event = { type: "automation", ...m } as unknown as Prisma.InputJsonValue;
  const made = await db.notificationDelivery.createMany({
    data: [{
      dedupeKey, kind: "GENERAL", channel, status: "PENDING", recipient,
      bookingId: m.bookingId ?? null, businessId: m.businessId, event, attempts: 1, lastAttemptAt: now,
    }],
    skipDuplicates: true,
  });
  if (made.count === 1) return { attempts: 1 };
  const row = await db.notificationDelivery.findUnique({ where: { dedupeKey }, select: { status: true, attempts: true, nextAttemptAt: true, updatedAt: true } });
  if (!row) return null;
  const retryDue = row.status === "FAILED" && !!row.nextAttemptAt && row.nextAttemptAt <= now;
  const abandoned = row.status === "PENDING" && row.updatedAt.getTime() < now.getTime() - STALE_PENDING_MS;
  if (!retryDue && !abandoned) return null;
  if (row.attempts >= MAX_ATTEMPTS) {
    await db.notificationDelivery.updateMany({
      where: { dedupeKey, status: row.status, updatedAt: row.updatedAt },
      data: { status: "DEAD", error: "gave up after every attempt", nextAttemptAt: null },
    });
    return null;
  }
  const took = await db.notificationDelivery.updateMany({
    where: { dedupeKey, status: row.status, updatedAt: row.updatedAt },
    data: { status: "PENDING", error: null, attempts: { increment: 1 }, lastAttemptAt: now },
  });
  return took.count === 1 ? { attempts: row.attempts + 1 } : null;
}

async function sendOn(channel: NotificationChannel, m: AutoMessage, address: string, userId: string | null): Promise<SendOutcome> {
  switch (channel) {
    case "IN_APP": {
      const row = await db.notification.create({
        data: { userId: address, kind: "GENERAL", title: m.title, body: m.body, href: m.href, bookingId: m.bookingId ?? null },
        select: { id: true },
      });
      return sent(row.id);
    }
    case "EMAIL":
      return sendEmail({ to: address, subject: m.title, html: notificationHtml(m.title, m.body, m.href) });
    case "PUSH": {
      if (!userId) return skipped("no-account");
      const devices = await db.deviceToken.findMany({ where: { userId, disabledAt: null }, select: { token: true } });
      const tokens = devices.map((d) => d.token).filter(isExpoToken);
      if (tokens.length === 0) return skipped("no-device");
      const { tickets, deadTokens } = await sendExpoPush(
        tokens.map((to) => ({ to, title: m.title, body: m.body, data: { kind: "automation", path: m.href }, sound: "default", channelId: "default", priority: "high" })),
      );
      if (deadTokens.length > 0) await db.deviceToken.updateMany({ where: { token: { in: deadTokens } }, data: { disabledAt: new Date() } });
      return tickets.some((t) => t?.status === "ok") ? sent() : failed("expo-error");
    }
    default:
      return skipped("channel-not-used");
  }
}

/**
 * Retries automation messages that failed (or whose sender died), from
 * the message stored on the row. Bounded per run; each row by the same
 * claim rule as a first send, so two runs cannot both resend one.
 */
export async function redriveAutomations(now: Date = new Date(), limit = 100): Promise<{ due: number; sent: number }> {
  const rows = await db.notificationDelivery.findMany({
    where: {
      dedupeKey: { startsWith: "auto:" },
      OR: [
        { status: "FAILED", nextAttemptAt: { lte: now } },
        { status: "PENDING", updatedAt: { lt: new Date(now.getTime() - STALE_PENDING_MS) } },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { dedupeKey: true, channel: true, recipient: true, event: true },
  });
  let sentCount = 0;
  for (const r of rows) {
    const m = r.event as unknown as (AutoMessage & { type?: string }) | null;
    if (!m || m.type !== "automation" || typeof m.title !== "string") {
      await db.notificationDelivery.update({ where: { dedupeKey: r.dedupeKey }, data: { status: "DEAD", error: "no stored message", nextAttemptAt: null } });
      continue;
    }
    const user = r.channel === "PUSH" ? r.recipient : null;
    const o = await deliver(m, r.channel, r.recipient, user, now);
    if (o.status === "SENT") sentCount++;
  }
  return { due: rows.length, sent: sentCount };
}
