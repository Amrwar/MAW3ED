import { sendWhatsAppMessage, sendWhatsAppTemplate } from "@/lib/services/whatsapp";
import type { SendOutcome } from "@/lib/services/send-outcome";
import { sent } from "@/lib/services/send-outcome";
import { log } from "@/lib/logger";

/**
 * Delivering a one-time code to a phone — sign-in, account deletion, a
 * business proving its number. One function, so every route tells the
 * truth about whether the code went out.
 *
 * WhatsApp only delivers a business-initiated message as an approved
 * template. A code sent as free text arrives only if the person wrote to
 * the number in the last 24 hours — in practice, almost never. So in
 * production the code goes as the "authentication" template named by
 * WHATSAPP_TEMPLATE_AUTH_CODE (body {{1}} = the code, plus the
 * copy-code button Meta requires on authentication templates).
 *
 * Without that template it falls back to free text, which is honest about
 * its result: a refusal from Meta comes back as a failure, and the route
 * says "could not send" rather than "check your WhatsApp".
 *
 * Locally, with no WhatsApp configured at all, the code is written to the
 * server log so QA can sign in. Never in production.
 */
export async function sendCode(phone: string, code: string, freeText: string): Promise<SendOutcome> {
  const template = process.env.WHATSAPP_TEMPLATE_AUTH_CODE?.trim();
  const configured = Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);

  if (!configured && process.env.NODE_ENV !== "production") {
    log.info(`[dev] one-time code for ${phone}: ${code}`);
    return sent("dev-log");
  }

  if (template) {
    return sendWhatsAppTemplate({
      to: phone,
      templateName: template,
      bodyParams: [{ type: "text", text: code }],
      urlButtonParam: code,
    });
  }

  return sendWhatsAppMessage({ to: phone, message: freeText });
}
