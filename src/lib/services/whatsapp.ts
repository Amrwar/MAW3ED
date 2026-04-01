/**
 * WhatsApp Cloud API service (Meta)
 *
 * Production setup:
 *  1. Go to developers.facebook.com → create a Meta Business App
 *  2. Add the "WhatsApp" product
 *  3. Under WhatsApp → API Setup, copy your Phone Number ID
 *  4. Generate a permanent System User access token with whatsapp_business_messaging scope
 *  5. Set the three env vars below
 *
 * Required environment variables:
 *   WHATSAPP_ACCESS_TOKEN    — Meta permanent access token
 *   WHATSAPP_PHONE_NUMBER_ID — Your WhatsApp business phone number ID
 *   WHATSAPP_API_VERSION     — Optional, defaults to v20.0
 *
 * Note on freeform vs. template messages:
 *   Meta allows freeform text messages only within a 24-hour customer-service window
 *   (i.e. within 24h of a customer messaging the business first).
 *   For outbound-first messages (like booking notifications), you MUST use pre-approved
 *   message templates created in Meta Business Manager.
 *   This service sends freeform text — suitable for dev/test and for businesses
 *   that are already in a conversation with your system.
 *   To use templates in production, replace `type: "text"` with `type: "template"`.
 */

const BASE_URL = "https://graph.facebook.com";
const VERSION  = process.env.WHATSAPP_API_VERSION ?? "v20.0";
const TOKEN    = process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

export interface WhatsAppTextPayload {
  to:      string;   // recipient phone (will be normalised to E.164)
  message: string;   // message body (max ~4096 chars, supports *bold* formatting)
}

/**
 * Send a freeform WhatsApp text message via Meta Cloud API.
 *
 * This function NEVER throws — errors are logged and the caller continues.
 * This ensures booking creation is never blocked by a notification failure.
 */
export async function sendWhatsAppMessage({ to, message }: WhatsAppTextPayload): Promise<void> {
  if (!TOKEN || !PHONE_ID) {
    console.warn(
      "[WhatsApp] Notifications disabled — set WHATSAPP_ACCESS_TOKEN and " +
      "WHATSAPP_PHONE_NUMBER_ID in your environment to enable them.",
    );
    return;
  }

  const phone = normalisePhone(to);
  if (!phone) {
    console.warn("[WhatsApp] Skipping — invalid phone number:", to);
    return;
  }

  const url  = `${BASE_URL}/${VERSION}/${PHONE_ID}/messages`;
  const body = JSON.stringify({
    messaging_product: "whatsapp",
    to:                phone,
    type:              "text",
    text:              { body: message, preview_url: false },
  });

  console.log(`[WhatsApp] Sending to ${phone} via phone ID ${PHONE_ID}`);

  try {
    const res = await fetch(url, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${TOKEN}`,
      },
      body,
    });

    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      console.log(`[WhatsApp] Sent successfully to ${phone}. Message ID: ${data?.messages?.[0]?.id ?? "unknown"}`);
    } else {
      const detail = await res.text().catch(() => "(no body)");
      console.error(`[WhatsApp] API error ${res.status} sending to ${phone}:`, detail);
    }
  } catch (err) {
    console.error("[WhatsApp] Network error sending to", phone, ":", err);
  }
}

// ─── Phone normalisation ──────────────────────────────────

/**
 * Converts a local or international phone number to E.164 format.
 * Defaults to Egypt country code (20) when no country code is present.
 *
 * Examples:
 *   "01012345678"   → "201012345678"
 *   "+201012345678" → "201012345678"
 *   "01012345678"   → "201012345678"
 */
function normalisePhone(raw: string): string | null {
  // Strip everything except digits and leading +
  let digits = raw.replace(/[^\d+]/g, "").replace(/^\+/, "");

  if (!digits) return null;

  // Egyptian local number: starts with 0, e.g. "01012345678"
  if (digits.startsWith("0") && digits.length <= 12) {
    digits = "20" + digits.slice(1);
  }

  // No country code detected for short numbers → assume Egypt (20)
  if (!digits.startsWith("20") && digits.length <= 11) {
    digits = "20" + digits;
  }

  // Minimum plausible length (country code + 8 digits)
  if (digits.length < 10) return null;

  return digits;
}
