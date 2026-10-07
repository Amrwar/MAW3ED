import { randomBytes } from "crypto";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import { ok, err } from "@/lib/api";
import { sendPasswordResetEmail, isEmailEnabled } from "@/lib/services/email";
import { log } from "@/lib/logger";
import { siteUrl } from "@/lib/env";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * POST /api/auth/forgot-password
 * Body: { email }
 *
 * Generates a secure reset token, stores it with a 1-hour expiry, and emails
 * the user a reset link. Always returns 200 regardless of whether the email
 * exists — prevents user enumeration.
 */
export async function POST(req: Request) {
  try {
    // Keyed on the caller when no account is named yet. 429 with
    // Retry-After, and a message that says nothing about whether
    // the account exists.
    const limited = await rateLimit("forgotPassword");
    if (!limited.ok) return tooManyRequests(limited);

    const { email } = await req.json();
    if (!email || typeof email !== "string") return err("أدخل البريد الإلكتروني", 422);

    const normalised = email.trim().toLowerCase();

    // Before the lookup, deliberately.
    //
    // This endpoint exists only to put a link in somebody's inbox. With
    // no mail provider configured it cannot do that for anybody, so say
    // so rather than returning { sent: true } and leaving the user
    // watching an inbox nothing is coming to.
    //
    // It has to be checked here, ahead of the lookup, because the answer
    // must not depend on whether the account exists. Checking after,
    // and reporting the failure only for real accounts, would turn a
    // broken mail provider into an account-enumeration oracle: 503 for
    // addresses that exist, 200 for addresses that do not.
    if (!isEmailEnabled()) {
      log.error("[forgot-password] no mail provider configured; cannot send reset links");
      return err("خدمة البريد غير متاحة حالياً. تواصل مع الدعم.", 503);
    }

    const user = await db.user.findUnique({ where: { email: normalised } });

    // Always respond with success to prevent user enumeration
    if (!user) {
      return ok({ sent: true });
    }

    // Delete any existing unused tokens for this email (one active token at a time)
    await db.passwordResetToken.deleteMany({ where: { email: normalised } });

    const token     = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

    await db.passwordResetToken.create({
      data: { email: normalised, token, expiresAt },
    });

    const base     = siteUrl;
    const resetUrl = `${base}/reset-password?token=${token}`;

    const outcome = await sendPasswordResetEmail(normalised, resetUrl);

    // A transient provider failure stays a uniform 200, for the same
    // enumeration reason as above: only a real account reaches this
    // line, so a visible error here would single those addresses out
    // whenever the provider was down. The operator finds it in the log
    // instead, which is why this is error and not warn.
    if (!outcome.ok) {
      log.error("[forgot-password] reset link not delivered", { reason: outcome.reason });
    }

    return ok({ sent: true });
  } catch (e) {
    log.error("[forgot-password]", e);
    return err("حدث خطأ، حاول مرة أخرى", 500);
  }
}
