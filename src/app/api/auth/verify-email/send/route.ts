import { db } from "@/lib/db";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { ok, err } from "@/lib/api";
import { auth } from "@/auth";
import { log } from "@/lib/logger";
import { siteUrl } from "@/lib/env";
import { sendEmailVerification, isEmailEnabled } from "@/lib/services/email";
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
    // In front of the per-account cooldown below, which needs an
    // account before it can throttle anything.
    const limited = await rateLimit("verifyEmail");
    if (!limited.ok) return tooManyRequests(limited);

    const session = await auth();
    if (!session?.user?.id) return err("غير مصرح", 401);

    // Checked before a token is minted, because issuing one would burn
    // the per-account cooldown below and invalidate the previous link
    // for a send that is not going to happen.
    if (!isEmailEnabled()) {
      log.error("[verify-email/send] no mail provider configured");
      return err("خدمة البريد غير متاحة حالياً. تواصل مع الدعم.", 503);
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, name: true, emailVerified: true },
    });
    if (!user) return err("لم يتم العثور على الحساب", 404);

    // A change of address still waiting on its link is what gets
    // resent, to the new address. It used to be wiped here and a plain
    // link mailed to the old address, so "resend" cancelled the change
    // the person had just asked for.
    const pending = await db.emailVerificationToken.findFirst({
      where: { userId: user.id, email: { not: null }, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      select: { email: true },
    });
    const changing = pending?.email && pending.email.toLowerCase() !== user.email?.toLowerCase();

    // Already done — say so rather than sending another email.
    if (!changing && user.emailVerified) return ok({ alreadyVerified: true });

    // Throttle resends per account.
    const recent = await db.emailVerificationToken.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    if (recent && !cooledDown(recent.createdAt, EMAIL_RESEND_COOLDOWN_MS)) {
      return err("انتظر دقيقة قبل طلب رابط جديد", 429);
    }

    // email is nullable on User now that customers sign in with a
    // phone; a customer who signed up by phone has no address to
    // verify, which is a different answer from a failed send.
    const target = changing ? pending!.email! : user.email;
    if (!target) {
      return err("مفيش بريد إلكتروني على الحساب", 422);
    }

    // One live token per account, of the kind being resent.
    await db.emailVerificationToken.deleteMany({
      where: { userId: user.id, email: changing ? { not: null } : null },
    });
    const token = generateEmailToken();
    await db.emailVerificationToken.create({
      data: {
        userId: user.id,
        email: changing ? target : null,
        tokenHash: hashSecret(token),
        expiresAt: new Date(Date.now() + EMAIL_TOKEN_TTL_MS),
      },
    });

    const outcome = await sendEmailVerification(
      target,
      `${siteUrl}/api/auth/verify-email/confirm?token=${token}`,
      user.name,
    );
    // This caller is signed in, so there is no address to enumerate and
    // nothing to hide: tell them it failed instead of logging "sent"
    // and returning { sent: true } the way this did before, which left
    // somebody waiting on a link that was never handed to a provider.
    if (!outcome.ok) {
      log.error("verification email not delivered", {
        userId: user.id,
        reason: outcome.reason,
      });
      return err("ما قدرناش نبعت الرابط. حاول تاني بعد شوية.", 502);
    }

    log.info("verification email sent", { userId: user.id });
    return ok({ sent: true });
  } catch (e) {
    log.error("[verify-email/send]", e);
    return err("حدث خطأ، حاول مرة أخرى", 500);
  }
}
