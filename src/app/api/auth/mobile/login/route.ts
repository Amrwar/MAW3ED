import { z } from "zod";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { ok, err } from "@/lib/api";
import { log } from "@/lib/logger";
import { verifyEmailPassword } from "@/lib/auth/verify";
import { startMobileSession } from "@/lib/auth/mobile-session";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  /** Shown back to the person in a list of their sessions. */
  // Cut, not refused: an Android device name is the owner's to edit and
  // can be longer; refusing it blocked sign-in (final audit M-05).
  deviceName: z.string().trim().transform((s) => s.slice(0, 80)).optional(),
  platform: z.enum(["ios", "android"]).optional(),
});

/**
 * POST /api/auth/mobile/login
 *
 * Sign in from a native app.
 *
 * It checks the password with verifyEmailPassword — the same function
 * the NextAuth Credentials provider calls — so there is one answer to
 * "is this password right" rather than two that can disagree.
 *
 * What it returns is a bearer pair, not a cookie: a short access token
 * the app sends on every request, and a long refresh token recorded as
 * a MobileSession row so it can be revoked.
 */
export async function POST(req: Request) {
  try {
    // Keyed on the caller when no account is named yet. 429 with
    // Retry-After, and a message that says nothing about whether
    // the account exists.
    const limited = await rateLimit("loginCaller");
    if (!limited.ok) return tooManyRequests(limited);

    const parsed = schema.safeParse(await req.json().catch(() => null));
    // Deliberately the same message as a wrong password: a different
    // one for a malformed body tells a prober how to shape their next
    // attempt.
    if (!parsed.success) return err("البريد الإلكتروني أو كلمة المرور غير صحيحة", 401);

    // And per account, the bucket the web sign-in uses: with the caller's
    // address alone, many addresses could grind one account without limit
    // (final audit S-01).
    const forAccount = await rateLimit("login", String(parsed.data.email).trim().toLowerCase());
    if (!forAccount.ok) return tooManyRequests(forAccount);

    const user = await verifyEmailPassword(parsed.data);
    if (!user) return err("البريد الإلكتروني أو كلمة المرور غير صحيحة", 401);

    const { deviceName, platform } = parsed.data;
    const login = await startMobileSession(user.id, { deviceName, platform });
    if (!login) return err("البريد الإلكتروني أو كلمة المرور غير صحيحة", 401);

    return ok(login);
  } catch (e) {
    log.error("[mobile login]", e);
    return err("حصلت مشكلة عندنا، جرّب تاني بعد شوية", 500);
  }
}
