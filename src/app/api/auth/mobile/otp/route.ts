import { z } from "zod";
import { callerKey, rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { ok, err } from "@/lib/api";
import { log } from "@/lib/logger";
import { normalisePhone } from "@/lib/phone";
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

    // And per number from this address. Not per number alone: then
    // anybody could spend a stranger's bucket with junk and lock them
    // out of signing in. Rotating addresses buys no extra guesses at one
    // code, which its own attempt counter caps. The web "phone-otp"
    // provider spends the same two buckets.
    const phone = normalisePhone(parsed.data.phone);
    if (phone) {
      const byPhone = await rateLimit("phoneOtpVerify", `${phone}:${await callerKey()}`);
      if (!byPhone.ok) return tooManyRequests(byPhone);
    }

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
    return err("حصلت مشكلة عندنا، جرّب تاني بعد شوية", 500);
  }
}
