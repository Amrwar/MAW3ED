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
import { customerConfirmationHtml, customerReminderHtml, businessAlertHtml } from "./email-templates";

const client  = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM    = process.env.EMAIL_FROM ?? "Maw3ed <noreply@maw3ed.app>";

export interface EmailPayload {
  to:      string;
  subject: string;
  html:    string;
}

/**
 * Base send helper — fire-and-forget, never throws.
 */
export async function sendEmail(payload: EmailPayload): Promise<void> {
  if (!client) {
    console.warn("[Email] Disabled — set RESEND_API_KEY to enable.");
    return;
  }

  const { error } = await client.emails.send({
    from:    FROM,
    to:      payload.to,
    subject: payload.subject,
    html:    payload.html,
  });

  if (error) {
    console.error("[Email] Resend error:", error);
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
}

// ── Public API ────────────────────────────────────────────────

/**
 * Send booking confirmation to the customer.
 * Only sent if customerEmail is provided and non-empty.
 */
export async function sendBookingConfirmationToCustomer(
  customerEmail: string,
  data: BookingEmailData,
): Promise<void> {
  if (!customerEmail?.trim()) return;

  await sendEmail({
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
): Promise<void> {
  if (!customerEmail?.trim()) return;

  await sendEmail({
    to:      customerEmail.trim(),
    subject: `⏰ تذكير: موعدك في ${data.businessName} غداً`,
    html:    customerReminderHtml(data),
  });
}

/**
 * Send new booking alert to the business owner.
 * Only sent if ownerEmail is provided and non-empty.
 */
export async function sendNewBookingAlertToBusiness(
  ownerEmail: string,
  data: BookingEmailData,
): Promise<void> {
  if (!ownerEmail?.trim()) return;

  await sendEmail({
    to:      ownerEmail.trim(),
    subject: `🗓️ موعد جديد من ${data.customerName}`,
    html:    businessAlertHtml(data),
  });
}
