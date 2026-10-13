/**
 * WhatsApp Cloud API service (Meta)
 *
 * Production setup:
 *  1. Go to developers.facebook.com → create a Meta Business App
 *  2. Add the "WhatsApp" product
 *  3. Under WhatsApp → API Setup, copy your Phone Number ID
 *  4. Generate a permanent System User access token (whatsapp_business_messaging scope)
 *  5. In Meta Business Manager → WhatsApp → Message Templates, create and get both
 *     templates approved before going live
 *  6. Set all env vars listed below in Vercel / .env
 *
 * Required environment variables:
 *   WHATSAPP_ACCESS_TOKEN                       — Meta permanent access token
 *   WHATSAPP_PHONE_NUMBER_ID                    — Your WhatsApp business phone number ID
 *
 * Optional environment variables (with defaults):
 *   WHATSAPP_API_VERSION                        — defaults to "v20.0"
 *   WHATSAPP_DEFAULT_LANGUAGE_CODE              — defaults to "ar"
 *   WHATSAPP_TEMPLATE_BUSINESS_NEW_BOOKING      — defaults to "maw3ed_business_new_booking"
 *   WHATSAPP_TEMPLATE_CUSTOMER_CONFIRMATION     — defaults to "maw3ed_customer_booking_confirmation"
 *
 * Template vs. freeform messages:
 *   Meta only allows freeform text within a 24-hour customer-service window after the
 *   recipient last messaged the business. Outbound-first notifications (booking alerts)
 *   MUST use pre-approved templates. This module exposes:
 *     - sendWhatsAppTemplate()              — production template sending (primary)
 *     - sendBusinessBookingTemplate()       — typed wrapper for owner alerts
 *     - sendCustomerConfirmationTemplate()  — typed wrapper for customer confirmations
 *     - sendWhatsAppMessage()               — freeform text (dev/test only)
 *
 * All send functions NEVER throw — errors are logged, booking creation continues.
 */

import { dialable } from "@/lib/phone";
import type { BookingNotificationData } from "./whatsapp-messages";
import { log } from "@/lib/logger";
import { failed, sent, skipped, type SendOutcome } from "./send-outcome";

// ─── Config ───────────────────────────────────────────────

const BASE_URL  = "https://graph.facebook.com";
const VERSION   = process.env.WHATSAPP_API_VERSION             ?? "v20.0";
const TOKEN     = process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_ID  = process.env.WHATSAPP_PHONE_NUMBER_ID;
const LANG_CODE = process.env.WHATSAPP_DEFAULT_LANGUAGE_CODE   ?? "ar";

const TEMPLATE_BUSINESS_NEW_BOOKING  =
  process.env.WHATSAPP_TEMPLATE_BUSINESS_NEW_BOOKING   ?? "maw3ed_business_new_booking";
const TEMPLATE_CUSTOMER_CONFIRMATION =
  process.env.WHATSAPP_TEMPLATE_CUSTOMER_CONFIRMATION  ?? "maw3ed_customer_booking_confirmation";
const TEMPLATE_CUSTOMER_REMINDER     =
  process.env.WHATSAPP_TEMPLATE_CUSTOMER_REMINDER      ?? "maw3ed_customer_reminder";

// ─── Types ────────────────────────────────────────────────

export interface WhatsAppTextPayload {
  to:      string; // recipient phone (will be normalised to E.164)
  message: string; // body text — max ~4096 chars, *bold* supported
}

/** A single positional parameter in a template component */
export interface WhatsAppTemplateParam {
  type: "text";
  text: string;
}

export interface WhatsAppTemplateSendOptions {
  to:           string;                    // raw phone number — will be normalised
  templateName: string;                    // name as registered in Meta Business Manager
  languageCode?: string;                   // BCP-47 code, e.g. "ar" or "en_US"
  bodyParams?:   WhatsAppTemplateParam[];  // maps to {{1}}, {{2}}, ... in the template body
  headerParams?: WhatsAppTemplateParam[];  // maps to header placeholders if template has one
}

// ─── Core: template sender ────────────────────────────────

/**
 * Send a Meta-approved WhatsApp template message.
 * This is the production-safe path for outbound-first notifications.
 * NEVER throws — all errors are caught and logged.
 */
export async function sendWhatsAppTemplate({
  to,
  templateName,
  languageCode = LANG_CODE,
  bodyParams   = [],
  headerParams = [],
}: WhatsAppTemplateSendOptions): Promise<SendOutcome> {
  if (!TOKEN || !PHONE_ID) {
    log.warn(
      "[WhatsApp] Template send disabled — set WHATSAPP_ACCESS_TOKEN and " +
      "WHATSAPP_PHONE_NUMBER_ID to enable notifications.",
    );
    return skipped("whatsapp-not-configured");
  }

  const phone = normalisePhone(to);
  if (!phone) {
    log.warn("WhatsApp: skipping template, invalid phone number", { to });
    return skipped("invalid-phone");
  }

  // Build components array — only include non-empty component arrays
  const components: object[] = [];
  if (headerParams.length > 0) {
    components.push({ type: "header", parameters: headerParams });
  }
  if (bodyParams.length > 0) {
    components.push({ type: "body", parameters: bodyParams });
  }

  const payload = {
    messaging_product: "whatsapp",
    to:                phone,
    type:              "template",
    template: {
      name:       templateName,
      language:   { code: languageCode },
      components,
    },
  };

  const url = `${BASE_URL}/${VERSION}/${PHONE_ID}/messages`;

  log.info(
    `[WhatsApp] Sending template "${templateName}" (${languageCode}) to ${phone}`,
  );

  try {
    const res = await fetch(url, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${TOKEN}`,
      },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      const msgId = (data as { messages?: { id: string }[] })?.messages?.[0]?.id ?? "unknown";
      log.info(
        `[WhatsApp] Template "${templateName}" sent to ${phone}. Message ID: ${msgId}`,
      );
      return sent(msgId);
    }

    const detail = await res.text().catch(() => "(no body)");
    log.error(
      `[WhatsApp] API error ${res.status} sending template "${templateName}" to ${phone}:`,
      detail,
    );
    return failed(`http-${res.status}`);
  } catch (err) {
    log.error("WhatsApp: network error sending template", err, { templateName, phone });
    return failed("network-error");
  }
}

// ─── Typed convenience wrappers ───────────────────────────

/**
 * Send the "new booking" template to the business owner.
 *
 * Expected template body in Meta Business Manager:
 *   🗓️ موعد جديد!
 *
 *   👤 العميل: {{1}}
 *   ✂️ الخدمة: {{2}}
 *   📅 التاريخ: {{3}}
 *   ⏰ الوقت: {{4}}
 *   💰 الإجمالي: {{5}}
 *
 *   ⏳ الحجز قيد الانتظار — أكده أو ألغه من لوحة التحكم.
 */
export async function sendBusinessBookingTemplate(
  to:   string,
  data: BookingNotificationData,
): Promise<SendOutcome> {
  return sendWhatsAppTemplate({
    to,
    templateName: TEMPLATE_BUSINESS_NEW_BOOKING,
    bodyParams: [
      param(data.customerName),                              // {{1}} Hello {{1}}
      param(data.businessName),                              // {{2}} booking with {{2}}
      param(data.serviceName),                               // {{3}} appointment for {{3}}
      param(formatDateAr(data.date)),                        // {{4}} on {{4}}
      param(formatTimeRange(data.startTime, data.endTime)),  // {{5}} at {{5}}
    ],
  });
}

/**
 * Send the "booking confirmation" template to the customer.
 *
 * Expected template body in Meta Business Manager:
 *   ✅ تم تسجيل حجزك في {{1}}!
 *
 *   ✂️ الخدمة: {{2}}
 *   📅 {{3}}
 *   ⏰ {{4}}
 *
 *   سيتواصل معك الفريق قريبًا. شكرًا لاستخدامك موعد 🙏
 */
export async function sendCustomerConfirmationTemplate(
  to:   string,
  data: BookingNotificationData,
): Promise<SendOutcome> {
  return sendWhatsAppTemplate({
    to,
    templateName: TEMPLATE_CUSTOMER_CONFIRMATION,
    bodyParams: [
      param(data.customerName),                                // {{1}} Hello {{1}}
      param(data.businessName),                                // {{2}} booking with {{2}}
      param(formatDateAr(data.date)),                          // {{3}} on {{3}}
      param(formatTimeRange(data.startTime, data.endTime)),    // {{4}} at {{4}}
    ],
  });
}

/**
 * Send a booking reminder template to the customer the day before.
 *
 * Expected template body in Meta Business Manager:
 *   ⏰ تذكير بموعدك غداً!
 *
 *   🏢 {{1}}
 *   ✂️ الخدمة: {{2}}
 *   📅 {{3}}
 *   ⏰ {{4}}
 *
 *   نراك غداً 👋
 */
export async function sendCustomerReminderTemplate(
  to:   string,
  data: BookingNotificationData,
): Promise<SendOutcome> {
  return sendWhatsAppTemplate({
    to,
    templateName: TEMPLATE_CUSTOMER_REMINDER,
    bodyParams: [
      param(formatDateAr(data.date)),
      param(formatTimeRange(data.startTime, data.endTime)),
    ],
  });
}

// ─── Dev/test: freeform sender (NOT for outbound-first production use) ─────

/**
 * Send a freeform WhatsApp text message.
 *
 * ⚠️  Only works within a 24-hour customer-service window (after the recipient
 *     last messaged you). Do NOT use for outbound booking notifications in
 *     production — use sendBusinessBookingTemplate / sendCustomerConfirmationTemplate.
 *
 * NEVER throws.
 */
export async function sendWhatsAppMessage({
  to,
  message,
}: WhatsAppTextPayload): Promise<SendOutcome> {
  if (!TOKEN || !PHONE_ID) {
    log.warn(
      "[WhatsApp] Freeform send disabled — set WHATSAPP_ACCESS_TOKEN and " +
      "WHATSAPP_PHONE_NUMBER_ID in your environment.",
    );
    return skipped("whatsapp-not-configured");
  }

  const phone = normalisePhone(to);
  if (!phone) {
    log.warn("WhatsApp: skipping freeform, invalid phone number", { to });
    return skipped("invalid-phone");
  }

  const url = `${BASE_URL}/${VERSION}/${PHONE_ID}/messages`;

  log.info(`[WhatsApp] Sending freeform text to ${phone} (dev/test path)`);

  try {
    const res = await fetch(url, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to:                phone,
        type:              "text",
        text:              { body: message, preview_url: false },
      }),
    });

    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      const msgId = (data as { messages?: { id: string }[] })?.messages?.[0]?.id ?? "unknown";
      log.info(`[WhatsApp] Freeform sent to ${phone}. Message ID: ${msgId}`);
      return sent(msgId);
    }

    const detail = await res.text().catch(() => "(no body)");
    log.error(`[WhatsApp] API error ${res.status} (freeform) sending to ${phone}:`, detail);
    return failed(`http-${res.status}`);
  } catch (err) {
    log.error("WhatsApp: network error sending freeform message", err, { phone });
    return failed("network-error");
  }
}

// ─── Phone normalisation (exported for reuse) ─────────────

/**
 * The number Meta's API wants: canonical digits, no plus. Any country;
 * a local-format number is read as Egyptian. See src/lib/phone.ts
 * dialable() — this used to prepend "20" to any short number, so a US
 * customer's +1 415… went to an Egyptian number that does not exist.
 */
export function normalisePhone(raw: string): string | null {
  return dialable(raw);
}

// ─── Local helpers ────────────────────────────────────────

function param(text: string): WhatsAppTemplateParam {
  return { type: "text", text };
}

function formatTimeRange(start: string, end: string): string {
  return end ? `${start} – ${end}` : start;
}

const AR_DAYS = [
  "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت",
];
const AR_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

function formatDateAr(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d, 12); // noon to avoid UTC midnight drift
  return `${AR_DAYS[date.getDay()]} ${d} ${AR_MONTHS[m - 1]} ${y}`;
}
