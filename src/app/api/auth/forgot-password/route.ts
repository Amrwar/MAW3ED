import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { ok, err } from "@/lib/api";
import { sendPasswordResetEmail } from "@/lib/services/email";
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
    const { email } = await req.json();
    if (!email || typeof email !== "string") return err("أدخل البريد الإلكتروني", 422);

    const normalised = email.trim().toLowerCase();

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

    await sendPasswordResetEmail(normalised, resetUrl);

    return ok({ sent: true });
  } catch (e) {
    log.error("[forgot-password]", e);
    return err("حدث خطأ، حاول مرة أخرى", 500);
  }
}
