import { randomBytes } from "crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, err } from "@/lib/api";
import { log } from "@/lib/logger";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { hashSecret } from "@/lib/verification";
import { siteUrl } from "@/lib/url";
import { sendWaitlistConfirmation } from "@/lib/services/email";

const schema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  query: z.string().trim().min(1).max(100),
  city: z.string().trim().max(60).regex(/^[a-z0-9-]*$/).optional(),
  lang: z.enum(["ar", "en"]).optional(),
});

/**
 * POST /api/public/waitlist
 * Body: { email, query, city?, lang? }
 *
 * "Tell me when one joins", from a search that found nothing.
 *
 * Anyone can type any address, so a request counts only once its owner
 * follows the link in the one email this sends
 * (GET /api/public/waitlist/confirm). Until then it is a row nobody
 * writes to. Asking again for the same thing sends a fresh link rather
 * than a second row; an already confirmed request is left as it is.
 */
export async function POST(req: Request) {
  try {
    const limited = await rateLimit("waitlist");
    if (!limited.ok) return tooManyRequests(limited);

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return err("اكتب إيميل صحيح", 422, { code: "invalid" });
    }
    const { email, city = "", lang = "ar" } = parsed.data;
    const query = parsed.data.query.toLowerCase();

    const perAddress = await rateLimit("waitlistEmail", email);
    if (!perAddress.ok) return tooManyRequests(perAddress);

    const key = { email_query_citySlug: { email, query, citySlug: city } };
    const existing = await db.waitlistRequest.findUnique({ where: key, select: { confirmedAt: true } });
    if (existing?.confirmedAt) return ok({ saved: true, confirmed: true });

    // Only the hash is stored, as for every other one-time link.
    const token = randomBytes(32).toString("hex");
    await db.waitlistRequest.upsert({
      where: key,
      create: { email, query, citySlug: city, lang, confirmToken: hashSecret(token) },
      update: { lang, confirmToken: hashSecret(token) },
    });

    const outcome = await sendWaitlistConfirmation(
      email,
      siteUrl(`/api/public/waitlist/confirm?token=${token}`),
      parsed.data.query,
      lang,
    );
    if (!outcome.ok) {
      log.error("[waitlist] confirmation not sent", { reason: outcome.reason });
      return err("تعذّر إرسال إيميل التأكيد، حاول تاني بعد شوية", 503, { code: "email-unavailable" });
    }

    return ok({ saved: true, confirmed: false });
  } catch (e) {
    log.error("[waitlist]", e);
    return err("تعذّر الحفظ، حاول تاني", 500);
  }
}
