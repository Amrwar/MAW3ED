import { db } from "@/lib/db";
import { ok, err, requireSession } from "@/lib/api";
import { createLoginCode } from "@/lib/auth/login-code";
import { deletionBlocker } from "@/lib/account/deletion";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { sendCode } from "@/lib/auth/send-code";
import { formatPhone } from "@/lib/phone";
import { log } from "@/lib/logger";

/**
 * POST /api/account/delete/code
 *
 * Step one of deleting an account: a fresh code to the account's own
 * verified phone. A session alone is not enough to delete — a phone left
 * unlocked on a table must not be one tap from erasing somebody — so
 * deletion asks for the same proof signing in does.
 *
 * The number is never taken from the request; it is the account's.
 */
export async function POST() {
  try {
    const session = await requireSession();

    const blocker = await deletionBlocker(session.user.id);
    if (blocker === "owns-business") {
      return err("الحساب ده مربوط بنشاط. كلّم الدعم عشان تقفل النشاط الأول.", 409, { code: "owns-business" });
    }
    if (blocker === "admin") return err("حساب الإدارة مايتحذفش من هنا", 409, { code: "admin" });
    if (blocker === "not-found") return err("غير مصرح", 401);

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { phone: true, phoneVerifiedAt: true },
    });
    if (!user?.phone || !user.phoneVerifiedAt) {
      return err("محتاجين رقم موبايل متأكد عشان نتأكد إنه إنت", 409, { code: "no-phone" });
    }

    const limited = await rateLimit("phoneOtp");
    if (!limited.ok) return tooManyRequests(limited);

    const result = await createLoginCode(user.phone);
    if (!result.ok) {
      if (result.reason === "cooldown") return err("استنى دقيقة قبل ما تطلب كود جديد", 429, { code: "cooldown" });
      if (result.reason === "too-many") return err("طلبت أكواد كتير. جرّب تاني بعد شوية", 429, { code: "too-many" });
      return err("رقم الموبايل غير صالح", 422, { code: "invalid-phone" });
    }

    const delivery = await sendCode(
      result.phone,
      result.code,
      `كود تأكيد حذف حسابك على موعد: ${result.code}\n\n` +
        `لو مش إنت اللي طلبت حذف الحساب، متديش الكود ده لحد.`,
    );
    // "Check your WhatsApp" only when a code really went out.
    if (!delivery.ok) {
      log.error("code not delivered", { reason: delivery.reason });
      return err("معرفناش نبعت الكود دلوقتي. جرّب تاني بعد شوية.", 503, { code: "send-failed" });
    }
    log.info("account deletion code sent", { phone: formatPhone(result.phone) });

    return ok({ sent: true, phone: formatPhone(result.phone) });
  } catch (e) {
    if (e instanceof Response) return e;
    log.error("[account delete code]", e);
    return err("تعذّر إرسال الكود، حاول تاني", 500);
  }
}
