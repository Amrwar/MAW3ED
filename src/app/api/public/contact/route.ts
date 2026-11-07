import { ok, err } from "@/lib/api";
import { log } from "@/lib/logger";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { isEmailEnabled, sendContactMessage } from "@/lib/services/email";
import { SUPPORT_EMAIL } from "@/lib/support";
import { contactFieldErrors, contactSchema, isTrapped, type ContactRole, type ContactTopic } from "@/lib/contact/form";

/** Where messages go: CONTACT_EMAIL when set, else the public support address. */
function inbox(): string {
  return process.env.CONTACT_EMAIL?.trim() || SUPPORT_EMAIL;
}

const ROLE_LABEL: Record<ContactRole, string> = {
  customer: "Customer",
  business: "Business owner",
  other: "Other",
};

const TOPIC_LABEL: Record<ContactTopic, string> = {
  booking: "Booking problem",
  account: "Account & sign-in",
  listing: "Business listing & dashboard",
  billing: "Billing & plans",
  partnership: "Partnership",
  other: "Other",
};

/**
 * POST /api/public/contact
 * Body: { name, email, phone?, role, topic, message, lang?, website? }
 *
 * Emails one message from the contact page to the support inbox, with
 * reply-to set to the visitor so answering is one click. Nothing is
 * stored. Throttled per caller and per sender address so the form
 * cannot be used to flood the inbox; a filled trap field is answered as
 * a success and dropped.
 */
export async function POST(req: Request) {
  try {
    const limited = await rateLimit("contact");
    if (!limited.ok) return tooManyRequests(limited);

    const body = await req.json().catch(() => null);
    if (isTrapped(body)) return ok({ sent: true });

    const parsed = contactSchema.safeParse(body);
    if (!parsed.success) {
      return err("راجع البيانات المكتوبة", 422, { code: "invalid", fields: contactFieldErrors(parsed.error) });
    }
    const d = parsed.data;

    const perAddress = await rateLimit("contactEmail", d.email);
    if (!perAddress.ok) return tooManyRequests(perAddress);

    if (!isEmailEnabled()) {
      log.error("[contact] email is not configured");
      return err("تعذّر إرسال الرسالة دلوقتي، ابعتلنا إيميل مباشرةً", 503, { code: "email-unavailable" });
    }

    const outcome = await sendContactMessage(inbox(), {
      name: d.name,
      email: d.email,
      phone: d.phone,
      role: ROLE_LABEL[d.role],
      topic: TOPIC_LABEL[d.topic],
      message: d.message,
      lang: d.lang ?? "ar",
      sentAt: new Date(),
    });
    if (!outcome.ok) {
      log.error("[contact] not sent", { reason: outcome.reason });
      return err("تعذّر إرسال الرسالة دلوقتي، ابعتلنا إيميل مباشرةً", 503, { code: "email-unavailable" });
    }

    return ok({ sent: true });
  } catch (e) {
    log.error("[contact]", e);
    return err("تعذّر إرسال الرسالة دلوقتي، ابعتلنا إيميل مباشرةً", 500);
  }
}
