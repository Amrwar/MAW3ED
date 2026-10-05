import { db } from "@/lib/db";
import { ok, err } from "@/lib/api";
import { auth } from "@/auth";
import { log } from "@/lib/logger";
import { siteUrl } from "@/lib/env";
import { sendEmailVerification } from "@/lib/services/email";
import {
  generateEmailToken,
  hashSecret,
  cooledDown,
  EMAIL_TOKEN_TTL_MS,
  EMAIL_RESEND_COOLDOWN_MS,
} from "@/lib/verification";

/**
 * POST /api/auth/verify-email/send
 *
 * Issues a fresh verification link to the signed-in user. Requires a
 * session: an unauthenticated endpoint that emails any address on
 * request is a spam relay.
 *
 * Only the hash of the token is stored; the plaintext exists solely in
 * the email.
 */
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) return err("غير مصرح", 401);

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, name: true, emailVerified: true },
    });
    if (!user) return err("لم يتم العثور على الحساب", 404);

    // Already done — say so rather than sending another email.
    if (user.emailVerified) return ok({ alreadyVerified: true });

    // Throttle resends per account.
    const recent = await db.emailVerificationToken.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    if (recent && !cooledDown(recent.createdAt, EMAIL_RESEND_COOLDOWN_MS)) {
      return err("انتظر دقيقة قبل طلب رابط جديد", 429);
    }

    // One live token per account.
    await db.emailVerificationToken.deleteMany({ where: { userId: user.id } });

    const token = generateEmailToken();
    await db.emailVerificationToken.create({
      data: {
        userId: user.id,
        tokenHash: hashSecret(token),
        expiresAt: new Date(Date.now() + EMAIL_TOKEN_TTL_MS),
      },
    });

    await sendEmailVerification(
      user.email,
      `${siteUrl}/api/auth/verify-email/confirm?token=${token}`,
      user.name,
    );

    log.info("verification email sent", { userId: user.id });
    return ok({ sent: true });
  } catch (e) {
    log.error("[verify-email/send]", e);
    return err("حدث خطأ، حاول مرة أخرى", 500);
  }
}
