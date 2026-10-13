import { z } from "zod";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { ok, err } from "@/lib/api";
import { log } from "@/lib/logger";
import { accountForVerifiedPhone, verifyLoginCode } from "@/lib/auth/login-code";
import { startMobileSession } from "@/lib/auth/mobile-session";

const schema = z.object({
  phone: z.string().min(6).max(20),
  code: z.string().min(4).max(10),
  deviceName: z.string().trim().max(80).optional(),
  platform: z.enum(["ios", "android"]).optional(),
});

/**
 * POST /api/auth/mobile/otp
 *
 * Sign in from the app with a phone code — how customers sign in.
 *
 * The code is requested through the same POST /api/auth/phone/send the
 * website uses; this is the second half. It verifies with
 * verifyLoginCode and finds or creates the account with
 * accountForVerifiedPhone — the functions the NextAuth "phone-otp"
 * provider calls — so the app and the website agree on what a valid
 * code is and on which account a number belongs to.
 *
 * Until this existed the app could only sign in with email and
 * password, which customers do not have.
 */
export async function POST(req: Request) {
  try {
    // The same bucket as sending a code: guessing at codes is the
    // attack, and it should cost what requesting them costs.
    const limited = await rateLimit("phoneOtp");
    if (!limited.ok) return tooManyRequests(limited);

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return err("الكود غير صحيح أو انتهت صلاحيته", 401);

    const result = await verifyLoginCode(parsed.data.phone, parsed.data.code);
    // One message for wrong, expired and used up, as on the website:
    // which of them it was is a hint to whoever is guessing.
    if (!result.ok) return err("الكود غير صحيح أو انتهت صلاحيته", 401);

    const account = await accountForVerifiedPhone(result.phone);
    const { deviceName, platform } = parsed.data;
    const login = await startMobileSession(account.id, { deviceName, platform });
    if (!login) return err("الكود غير صحيح أو انتهت صلاحيته", 401);

    return ok(login);
  } catch (e) {
    log.error("[mobile otp login]", e);
    return err("حدث خطأ", 500);
  }
}
