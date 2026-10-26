import { z } from "zod";
import { callerKey, rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { ok, err } from "@/lib/api";
import { log } from "@/lib/logger";
import { normalisePhone, PHONE_INVALID } from "@/lib/phone";
import { verifyLoginCode } from "@/lib/auth/login-code";
import { issuePhoneProof } from "@/lib/bookings/phone-proof";

const schema = z.object({
  phone: z.string().min(6).max(20),
  code: z.string().min(4).max(10),
});

/**
 * POST /api/public/phone-proof
 * Body: { phone, code }
 *
 * Trades the code sent by POST /api/auth/phone/send for a short-lived
 * proof that this visitor controls the number (lib/bookings/phone-proof),
 * which a guest booking then carries. Signs nobody in.
 *
 * The same code store and limits as signing in: five guesses at a code,
 * and a ceiling per number and caller on top.
 */
export async function POST(req: Request) {
  try {
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return err("اكتب الكود اللي وصلك", 422, { code: "invalid" });

    const phone = normalisePhone(parsed.data.phone);
    if (!phone) return err(PHONE_INVALID, 422, { code: "invalid-phone" });

    const limited = await rateLimit("phoneOtpVerify", `${phone}:${await callerKey()}`);
    if (!limited.ok) return tooManyRequests(limited);

    const result = await verifyLoginCode(phone, parsed.data.code);
    if (!result.ok) {
      switch (result.reason) {
        case "wrong":
          return err("الكود مش صحيح", 422, { code: "wrong-code" });
        case "expired":
        case "no-code":
          return err("الكود انتهى. اطلب كود جديد", 422, { code: "expired-code" });
        case "too-many-attempts":
          return err("محاولات كتير. اطلب كود جديد", 429, { code: "too-many-attempts" });
        case "invalid-phone":
          return err(PHONE_INVALID, 422, { code: "invalid-phone" });
      }
    }

    return ok({ proof: await issuePhoneProof(result.phone) });
  } catch (e) {
    log.error("[phone proof]", e);
    return err("تعذّر التحقق من الكود، حاول تاني", 500);
  }
}
