import type { NotificationChannel } from "@prisma/client";
import { db } from "@/lib/db";
import { log } from "@/lib/logger";
import { failed, sent, skipped, type SendOutcome } from "@/lib/services/send-outcome";
import { sendEmail } from "@/lib/services/email";
import { sendWhatsAppMessage } from "@/lib/services/whatsapp";
import { notificationHtml } from "@/lib/services/email-templates";
import { smsText, type Copy } from "./copy";
import type { Recipient } from "./recipients";
import type { NotificationEvent } from "./events";
import { EVENT_KIND } from "./events";
import { bespokeSender, type BespokeContext } from "./templates";

/**
 * The four ways a notification leaves the building.
 *
 * Each one is a thin wrapper over a sender that already exists and
 * already works. None of them decides whether to send — that is the
 * dispatcher's job — and none of them throws, because a notification
 * failing must never fail the booking it is about.
 */

export interface ChannelInput {
  event: NotificationEvent;
  recipient: Recipient;
  copy: Copy;
  bookingId: string | null;
  businessId: string | null;
  /** The data the hand-written templates need, when one applies. */
  bespoke: BespokeContext;
}

export type Channel = {
  name: NotificationChannel;
  /** The address this channel would use, for the ledger. */
  address: (r: Recipient) => string | null;
  send: (input: ChannelInput) => Promise<SendOutcome>;
};

/* ─── In-app ─────────────────────────────────────────────── */

export const inAppChannel: Channel = {
  name: "IN_APP",
  address: (r) => r.userId,
  async send({ event, recipient, copy, bookingId }) {
    if (!recipient.userId) return skipped("no-account");
    try {
      const row = await db.notification.create({
        data: {
          userId: recipient.userId,
          kind: EVENT_KIND[event.type],
          title: copy.title,
          body: copy.body ?? null,
          href: recipient.href,
          bookingId,
        },
        select: { id: true },
      });
      return sent(row.id);
    } catch (e) {
      log.error("[notify:in-app]", e);
      return failed("db-error");
    }
  },
};

/* ─── Email ──────────────────────────────────────────────── */

export const emailChannel: Channel = {
  name: "EMAIL",
  address: (r) => r.email,
  async send({ recipient, copy }) {
    if (!recipient.email) return skipped("no-address");
    return sendEmail({
      to: recipient.email,
      subject: copy.title,
      html: notificationHtml(copy.title, copy.body ?? null, recipient.href),
    });
  },
};

/* ─── WhatsApp ───────────────────────────────────────────── */

/**
 * Meta only allows a freeform message inside the 24-hour window that
 * opens when the customer writes to us; outside it, a message has to
 * use an approved template. The existing booking flows already send
 * the right templates for confirmation and reminders and keep doing
 * so — this is for the events that have no template of their own, and
 * it is honest about what that means: outside the window Meta refuses
 * it, the ledger records the refusal, and the in-app and email copies
 * still arrived.
 */
export const whatsappChannel: Channel = {
  name: "WHATSAPP",
  address: (r) => r.phone,
  async send({ event, recipient, copy, bespoke }) {
    if (!recipient.phone) return skipped("no-number");

    // An approved template wherever one exists — Meta will not deliver
    // freeform text outside the 24-hour window, so a template is not a
    // nicety here, it is the only thing that arrives.
    const hand = bespokeSender(event, recipient.audience, "WHATSAPP");
    const handled = hand?.(recipient.phone, bespoke);
    if (handled) return handled;

    const body = copy.body ? `${copy.title}

${copy.body}` : copy.title;
    return sendWhatsAppMessage({ to: recipient.phone, message: body });
  },
};

/* ─── SMS ────────────────────────────────────────────────── */

/**
 * Dormant until a gateway is configured.
 *
 * Maw3ed has no SMS provider. Rather than pretend, this reports
 * "skipped: sms-not-configured" and the ledger says so plainly. Wiring
 * a provider is this one function: read SMS_API_URL and SMS_API_KEY,
 * POST, return sent() or failed(). Everything else — preferences,
 * deduplication, the ledger — already treats SMS as a real channel.
 */
export const smsChannel: Channel = {
  name: "SMS",
  address: (r) => r.phone,
  async send({ recipient, copy }) {
    const url = process.env.SMS_API_URL;
    const key = process.env.SMS_API_KEY;
    const sender = process.env.SMS_SENDER_ID;
    if (!url || !key) return skipped("sms-not-configured");
    if (!recipient.phone) return skipped("no-number");

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          to: recipient.phone,
          from: sender ?? "MAW3ED",
          text: smsText(copy),
        }),
      });
      if (!res.ok) {
        log.error(`[notify:sms] gateway returned ${res.status}`);
        return failed(`http-${res.status}`);
      }
      return sent();
    } catch (e) {
      log.error("[notify:sms]", e);
      return failed("network-error");
    }
  },
};

export const CHANNELS: Channel[] = [inAppChannel, emailChannel, whatsappChannel, smsChannel];

/** Whether a recipient has allowed this channel. */
export function allows(recipient: Recipient, channel: NotificationChannel): boolean {
  switch (channel) {
    case "IN_APP":
      return recipient.allow.inApp;
    case "EMAIL":
      return recipient.allow.email;
    case "WHATSAPP":
      return recipient.allow.whatsapp;
    case "SMS":
      return recipient.allow.sms;
  }
}
