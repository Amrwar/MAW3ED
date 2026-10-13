import { createLoginCode } from "@/lib/auth/login-code";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { ok, err } from "@/lib/api";
import { sendCode } from "@/lib/auth/send-code";
import { formatPhone, PHONE_INVALID } from "@/lib/phone";
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
    // Keyed on the caller when no account is named yet. 429 with
    // Retry-After, and a message that says nothing about whether
    // the account exists.
    const limited = await rateLimit("phoneOtp");
    if (!limited.ok) return tooManyRequests(limited);

    const body = await req.json().catch(() => null);
    const raw = typeof body?.phone === "string" ? body.phone : "";
    if (!raw) return err("أدخل رقم الموبايل", 422);

    const result = await createLoginCode(raw);

    if (!result.ok) {
      switch (result.reason) {
        case "invalid-phone":
          return err(PHONE_INVALID, 422);
        case "cooldown":
          return err("استنى دقيقة قبل ما تطلب كود جديد", 429);
        case "too-many":
          return err("طلبت أكواد كتير. جرّب تاني بعد شوية", 429);
      }
    }

    const delivery = await sendCode(
      result.phone,
      result.code,
      `كود الدخول على موعد: ${result.code}\n\n` +
        `الكود صالح لمدة 10 دقائق. لو مش إنت اللي طلبته، تجاهل الرسالة ومتديهوش لحد.`,
    );
    // "Check your WhatsApp" only when a code really went out.
    if (!delivery.ok) {
      log.error("code not delivered", { reason: delivery.reason });
      return err("معرفناش نبعت الكود دلوقتي. جرّب تاني بعد شوية.", 503, { code: "send-failed" });
    }

    // The code is never logged, and the number is only logged masked.
    log.info("login code sent", { phone: formatPhone(result.phone) });

    return ok({ sent: true });
  } catch (e) {
    log.error("[phone login send]", e);
    return err("تعذّر إرسال الكود، حاول تاني", 500);
  }
}
