import { db } from "@/lib/db";
import { signUpSchema } from "@/lib/validations";
import { ok, err } from "@/lib/api";
import bcrypt from "bcryptjs";
import { log } from "@/lib/logger";
import { siteUrl } from "@/lib/env";
import { sendEmailVerification } from "@/lib/services/email";
import {
  generateEmailToken,
  hashSecret,
  EMAIL_TOKEN_TTL_MS,
} from "@/lib/verification";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = signUpSchema.safeParse(body);

    if (!parsed.success) {
      return err(parsed.error.issues[0].message, 422);
    }

    const { name, email, password } = parsed.data;

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return err("هذا البريد الإلكتروني مسجل بالفعل", 409);
    }

    const hashed = await bcrypt.hash(password, 12);

    const user = await db.user.create({
      data: { name, email, password: hashed },
      select: { id: true, email: true, name: true },
    });

    // Prove the address is theirs before the account can publish a
    // business. Sending is fire-and-forget: a mail outage must not
    // block signup, and the link can always be re-requested.
    const token = generateEmailToken();
    await db.emailVerificationToken.create({
      data: {
        userId: user.id,
        tokenHash: hashSecret(token),
        expiresAt: new Date(Date.now() + EMAIL_TOKEN_TTL_MS),
      },
    });
    // email is nullable on User now that customers sign in with a
    // phone; an owner always has one, so this never skips in practice.
    if (user.email) await sendEmailVerification(
      user.email,
      `${siteUrl}/api/auth/verify-email/confirm?token=${token}`,
      user.name,
    );

    return ok({ user, verificationSent: true }, 201);
  } catch (e) {
    log.error("[signup]", e);
    return err("حدث خطأ أثناء إنشاء الحساب", 500);
  }
}
