import { z } from "zod";
import { ok, err, requireSession } from "@/lib/api";
import { verifyLoginCode } from "@/lib/auth/login-code";
import { linkVerifiedPhone } from "@/lib/account/link-phone";
import { callerKey, rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { normalisePhone, PHONE_INVALID } from "@/lib/phone";
import { log } from "@/lib/logger";

const schema = z.object({
  phone: z.string().trim().min(6).max(20),
  code: z.string().trim().min(4).max(10),
});

/**
 * POST /api/account/phone
 * Body: { phone, code }
 *
 * Adds a proved phone to the signed-in account: the step a Google
 * sign-in takes before the customer area can find its bookings. The
 * code comes from POST /api/auth/phone/send, exactly as for a phone
 * sign-in, and is checked and consumed the same way.
 *
 * Answers { linked: true } when the number is now this account's, or
 * { merged: true } when it belonged to another account and this one,
 * holding nothing but its Google link, was folded into it: the browser
 * then signs in with Google again and lands there (lib/account/link-phone).
 */
export async function POST(req: Request) {
  try {
    const session = await requireSession();

    // The buckets a phone sign-in spends (src/auth.ts), so this is not a
    // cheaper door to guess codes through: per caller, then per number
    // and caller together, so nobody can lock a stranger's number out.
    const byCaller = await rateLimit("phoneOtp");
    if (!byCaller.ok) return tooManyRequests(byCaller);

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return err("اكتب رقم الموبايل والكود", 422);

    const phone = normalisePhone(parsed.data.phone);
    if (!phone) return err(PHONE_INVALID, 422);

    const byPhone = await rateLimit("phoneOtpVerify", `${phone}:${await callerKey()}`);
    if (!byPhone.ok) return tooManyRequests(byPhone);

    const verified = await verifyLoginCode(phone, parsed.data.code);
    // Which of wrong, expired or used up is deliberately not said.
    if (!verified.ok) return err("الكود غير صحيح أو انتهت صلاحيته", 400);

    const result = await linkVerifiedPhone(session.user.id, verified.phone);
    switch (result.outcome) {
      case "linked":
        return ok({ linked: true });
      case "merged":
        return ok({ merged: true });
      case "refused":
        if (result.reason === "gone") return err("انتهت الجلسة، سجّل الدخول من تاني", 401);
        if (result.reason === "has-phone") return err("حسابك عليه رقم موبايل متأكّد بالفعل", 409);
        return err(
          "الرقم ده مربوط بحساب تاني على موعد. اخرج وادخل برقم الموبايل عشان توصل لحجوزاته.",
          409,
          { code: "phone-taken" },
        );
    }
  } catch (e) {
    if (e instanceof Response) return e;
    log.error("[account phone]", e);
    return err("حصلت مشكلة عندنا، جرّب تاني بعد شوية", 500);
  }
}
