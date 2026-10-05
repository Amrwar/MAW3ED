import { db } from "@/lib/db";
import { ok, err, requireBusiness } from "@/lib/api";
import { log } from "@/lib/logger";
import { sendWhatsAppMessage } from "@/lib/services/whatsapp";
import {
  generatePhoneCode,
  hashSecret,
  cooledDown,
  normaliseEgyptianMobile,
  formatEgyptianMobile,
  PHONE_CODE_TTL_MS,
  PHONE_RESEND_COOLDOWN_MS,
} from "@/lib/verification";

/**
 * POST /api/business/verify-phone/send
 * Body: { phone }
 *
 * Sends a one-time code over WhatsApp to prove the business controls
 * the number every booking notification will go to. Session-gated and
 * rate-limited, because an open endpoint that sends WhatsApp messages
 * to an arbitrary number is a way to harass people using our sender ID.
 *
 * Only the hash of the code is stored.
 */
export async function POST(req: Request) {
  try {
    const { business } = await requireBusiness();

    const body = await req.json().catch(() => null);
    const raw = typeof body?.phone === "string" ? body.phone : business.whatsapp ?? business.phone;
    if (!raw) return err("أدخل رقم الواتساب", 422);

    const phone = normaliseEgyptianMobile(raw);
    if (!phone) return err("رقم غير صحيح — لازم يكون رقم موبايل مصري", 422);

    // Throttle per business, regardless of the number requested.
    const recent = await db.phoneVerification.findFirst({
      where: { businessId: business.id },
      orderBy: { lastSentAt: "desc" },
      select: { lastSentAt: true },
    });
    if (recent && !cooledDown(recent.lastSentAt, PHONE_RESEND_COOLDOWN_MS)) {
      return err("انتظر دقيقة قبل طلب كود جديد", 429);
    }

    // One live code per business.
    await db.phoneVerification.deleteMany({ where: { businessId: business.id } });

    const code = generatePhoneCode();
    await db.phoneVerification.create({
      data: {
        businessId: business.id,
        phone,
        codeHash: hashSecret(code),
        expiresAt: new Date(Date.now() + PHONE_CODE_TTL_MS),
      },
    });

    await sendWhatsAppMessage({
      to: phone,
      message:
        `كود تأكيد رقمك على موعد: ${code}\n\n` +
        `الكود صالح لمدة 10 دقائق. لو مش إنت اللي طلبته، تجاهل الرسالة.`,
    });

    // The code itself is never logged.
    log.info("phone verification code sent", { businessId: business.id });

    return ok({ sent: true, phone: formatEgyptianMobile(phone) });
  } catch (e) {
    if (e instanceof Response) return e;
    log.error("[verify-phone/send]", e);
    return err("حدث خطأ، حاول مرة أخرى", 500);
  }
}
