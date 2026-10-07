/**
 * Resend email service for Maw3ed transactional emails.
 *
 * Setup:
 *  1. Go to resend.com → create an account → add a sending domain
 *  2. Create an API key and set RESEND_API_KEY in .env
 *  3. Set EMAIL_FROM to a verified address, e.g. "موعد <noreply@yourdomain.com>"
 *
 * This service NEVER throws — errors are logged and callers continue.
 */

import { Resend } from "resend";
import {
  customerConfirmationHtml,
  customerReminderHtml,
  businessAlertHtml,
  passwordResetHtml,
  subscriptionRenewalReminderHtml,
  subscriptionExpiredHtml,
  emailVerificationHtml,
} from "./email-templates";
import { log } from "@/lib/logger";
import { failed, sent, skipped, type SendOutcome } from "./send-outcome";

const client  = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM    = process.env.EMAIL_FROM ?? "Maw3ed <noreply@maw3ed.net>";

/**
 * Whether a send will be attempted at all.
 *
 * A route that exists only to put a link in somebody's inbox needs to
 * know this BEFORE it tells them to go and look: "check your email" is
 * a lie when there is no key to send with, and it is a lie that costs
 * the user their account rather than merely confusing them.
 *
 * Deliberately the same condition as `client` above rather than
 * getIntegrations().email, which also requires EMAIL_FROM. EMAIL_FROM
 * has a working default, so demanding it here would refuse sends that
 * currently succeed.
 */
export function isEmailEnabled(): boolean {
  return client !== null;
}

export interface EmailPayload {
  to:      string;
  subject: string;
  html:    string;
}

/**
 * Base send helper — fire-and-forget, never throws.
 */
export async function sendEmail(payload: EmailPayload): Promise<SendOutcome> {
  if (!client) {
    log.warn("[Email] Disabled — set RESEND_API_KEY to enable.");
    return skipped("email-not-configured");
  }
  if (!payload.to) return skipped("no-address");

  try {
    const { data, error } = await client.emails.send({
      from:    FROM,
      to:      payload.to,
      subject: payload.subject,
      html:    payload.html,
    });

    if (error) {
      log.error("[Email] Resend error:", error);
      return failed(error.name ?? "resend-error");
    }
    return sent(data?.id);
  } catch (e) {
    // The client can throw on a network failure; it never used to
    // escape this function and it still does not.
    log.error("[Email] Network error:", e);
    return failed("network-error");
  }
}

// ── Booking notification data shape ──────────────────────────

export interface BookingEmailData {
  businessName:  string;
  serviceName:   string;
  date:          string; // "YYYY-MM-DD"
  startTime:     string; // "HH:MM"
  endTime:       string; // "HH:MM"
  customerName:  string;
  customerPhone: string;
  totalPrice:    number;
  currency:      string;
  notes?:        string | null;
  bookingUrl?:   string | null;
}

// ── Public API ────────────────────────────────────────────────

/**
 * Send booking confirmation to the customer.
 * Only sent if customerEmail is provided and non-empty.
 */
export async function sendBookingConfirmationToCustomer(
  customerEmail: string,
  data: BookingEmailData,
): Promise<SendOutcome> {
  if (!customerEmail?.trim()) return skipped("no-address");

  return sendEmail({
    to:      customerEmail.trim(),
    subject: `✅ تم تسجيل حجزك في ${data.businessName}`,
    html:    customerConfirmationHtml(data),
  });
}

/**
 * Send a reminder to the customer the day before their booking.
 * Only sent if customerEmail is provided and non-empty.
 */
export async function sendBookingReminderToCustomer(
  customerEmail: string,
  data: BookingEmailData,
): Promise<SendOutcome> {
  if (!customerEmail?.trim()) return skipped("no-address");

  return sendEmail({
    to:      customerEmail.trim(),
    subject: `⏰ تذكير: موعدك في ${data.businessName} غداً`,
    html:    customerReminderHtml(data),
  });
}

/**
 * Send a password-reset link to the user.
 */
export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string,
): Promise<SendOutcome> {
  if (!to?.trim()) return skipped("no-address");
  return sendEmail({
    to:      to.trim(),
    subject: "🔐 إعادة تعيين كلمة المرور — موعد",
    html:    passwordResetHtml(resetUrl),
  });
}

/**
 * Send reschedule confirmation to the customer.
 */
export async function sendRescheduleConfirmationToCustomer(
  customerEmail: string,
  data: BookingEmailData,
): Promise<SendOutcome> {
  if (!customerEmail?.trim()) return skipped("no-address");
  return sendEmail({
    to:      customerEmail.trim(),
    subject: `📅 تم إعادة جدولة حجزك في ${data.businessName}`,
    html:    customerConfirmationHtml(data),
  });
}

/**
 * Send reschedule alert to the business owner.
 */
export async function sendRescheduleAlertToBusiness(
  ownerEmail: string,
  data: BookingEmailData,
): Promise<SendOutcome> {
  if (!ownerEmail?.trim()) return skipped("no-address");
  return sendEmail({
    to:      ownerEmail.trim(),
    subject: `🔄 إعادة جدولة حجز من ${data.customerName}`,
    html:    businessAlertHtml(data),
  });
}

/**
 * Send a subscription renewal reminder to the business owner (3 days before expiry).
 */
export async function sendSubscriptionRenewalReminder(
  ownerEmail: string,
  params: {
    businessName: string;
    planName:     string;
    expiryDate:   string;
    renewUrl:     string;
    daysLeft:     number;
  },
): Promise<SendOutcome> {
  if (!ownerEmail?.trim()) return skipped("no-address");
  return sendEmail({
    to:      ownerEmail.trim(),
    subject: `⏰ اشتراكك في موعد سينتهي خلال ${params.daysLeft} أيام`,
    html:    subscriptionRenewalReminderHtml(params),
  });
}

/**
 * Send a subscription expired notification to the business owner.
 */
export async function sendSubscriptionExpiredEmail(
  ownerEmail: string,
  params: {
    businessName: string;
    planName:     string;
    renewUrl:     string;
  },
): Promise<SendOutcome> {
  if (!ownerEmail?.trim()) return skipped("no-address");
  return sendEmail({
    to:      ownerEmail.trim(),
    subject: "😔 انتهى اشتراكك في موعد — جدِّد الآن",
    html:    subscriptionExpiredHtml(params),
  });
}

/**
 * Send new booking alert to the business owner.
 * Only sent if ownerEmail is provided and non-empty.
 */
export async function sendNewBookingAlertToBusiness(
  ownerEmail: string,
  data: BookingEmailData,
): Promise<SendOutcome> {
  if (!ownerEmail?.trim()) return skipped("no-address");

  return sendEmail({
    to:      ownerEmail.trim(),
    subject: `🗓️ موعد جديد من ${data.customerName}`,
    html:    businessAlertHtml(data),
  });
}

/**
 * Send the signup verification link.
 */
export async function sendEmailVerification(
  to: string,
  verifyUrl: string,
  name?: string | null,
): Promise<SendOutcome> {
  if (!to?.trim()) return skipped("no-address");
  return sendEmail({
    to:      to.trim(),
    subject: "أكّد بريدك الإلكتروني — موعد",
    html:    emailVerificationHtml(verifyUrl, name),
  });
}
