import { z } from "zod";
import { db } from "@/lib/db";
import { ok, err } from "@/lib/api";
import { log } from "@/lib/logger";
import { verifyEmailPassword } from "@/lib/auth/verify";
import { claimsForUser, issueTokens, MOBILE_TOKEN_TTL } from "@/lib/auth/mobile-token";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  /** Shown back to the person in a list of their sessions. */
  deviceName: z.string().trim().max(80).optional(),
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
    const parsed = schema.safeParse(await req.json().catch(() => null));
    // Deliberately the same message as a wrong password: a different
    // one for a malformed body tells a prober how to shape their next
    // attempt.
    if (!parsed.success) return err("البريد الإلكتروني أو كلمة المرور غير صحيحة", 401);

    const user = await verifyEmailPassword(parsed.data);
    if (!user) return err("البريد الإلكتروني أو كلمة المرور غير صحيحة", 401);

    const claims = await claimsForUser(user.id);
    if (!claims) return err("البريد الإلكتروني أو كلمة المرور غير صحيحة", 401);

    const expiresAt = new Date(Date.now() + MOBILE_TOKEN_TTL.refreshDays * 86_400_000);
    const session = await db.mobileSession.create({
      data: {
        userId: user.id,
        deviceName: parsed.data.deviceName ?? null,
        platform: parsed.data.platform ?? null,
        expiresAt,
      },
      select: { id: true },
    });

    const tokens = await issueTokens(claims, session.id);

    return ok({
      ...tokens,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        businessId: claims.businessId,
        adminRole: claims.adminRole,
      },
    });
  } catch (e) {
    log.error("[mobile login]", e);
    return err("حدث خطأ", 500);
  }
}
