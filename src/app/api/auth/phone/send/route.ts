import { createLoginCode } from "@/lib/auth/login-code";
import { ok, err } from "@/lib/api";
import { sendWhatsAppMessage } from "@/lib/services/whatsapp";
import { formatEgyptianMobile } from "@/lib/verification";
import { log } from "@/lib/logger";

/**
 * POST /api/auth/phone/send
 * Body: { phone }
 *
 * Sends a sign-in code over WhatsApp.
 *
 * Open by necessity — somebody signing in has no session yet — which is
 * why every guard lives in createLoginCode: one live code per number, a
 * cooldown between sends, and a ceiling per hour so this cannot be used
 * to bombard a stranger with messages from our sender.
 *
 * The response never says whether the number has an account. Answering
 * that would turn this into a way to test which phone numbers are
 * registered.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const raw = typeof body?.phone === "string" ? body.phone : "";
    if (!raw) return err("أدخل رقم الموبايل", 422);

    const result = await createLoginCode(raw);

    if (!result.ok) {
      switch (result.reason) {
        case "invalid-phone":
          return err("رقم غير صحيح — لازم يكون رقم موبايل مصري", 422);
        case "cooldown":
          return err("استنى دقيقة قبل ما تطلب كود جديد", 429);
        case "too-many":
          return err("طلبت أكواد كتير. جرّب تاني بعد شوية", 429);
      }
    }

    await sendWhatsAppMessage({
      to: result.phone,
      message:
        `كود الدخول على موعد: ${result.code}\n\n` +
        `الكود صالح لمدة 10 دقائق. لو مش إنت اللي طلبته، تجاهل الرسالة ومتديهوش لحد.`,
    });

    // The code is never logged, and the number is only logged masked.
    log.info("login code sent", { phone: formatEgyptianMobile(result.phone) });

    return ok({ sent: true });
  } catch (e) {
    log.error("[phone login send]", e);
    return err("تعذّر إرسال الكود، حاول تاني", 500);
  }
}
