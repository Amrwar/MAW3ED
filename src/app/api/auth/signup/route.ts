import { db } from "@/lib/db";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { signUpSchema } from "@/lib/validations";
import { ok, err } from "@/lib/api";
import bcrypt from "bcryptjs";
import { log } from "@/lib/logger";
import { siteUrl } from "@/lib/env";
import { sendEmailVerification } from "@/lib/services/email";
import { skipped } from "@/lib/services/send-outcome";
import {
  generateEmailToken,
  hashSecret,
  EMAIL_TOKEN_TTL_MS,
} from "@/lib/verification";

export async function POST(req: Request) {
  try {
    // Keyed on the caller when no account is named yet. 429 with
    // Retry-After, and a message that says nothing about whether
    // the account exists.
    const limited = await rateLimit("signup");
    if (!limited.ok) return tooManyRequests(limited);

    const body = await req.json();
    const parsed = signUpSchema.safeParse(body);

    if (!parsed.success) {
      return err(parsed.error.issues[0].message, 422);
    }

    const { name, email, password } = parsed.data;

    // Older accounts may be stored in mixed case; one mailbox, one account.
    const existing = await db.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
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
    const outcome = user.email
      ? await sendEmailVerification(
          user.email,
          `${siteUrl}/api/auth/verify-email/confirm?token=${token}`,
          user.name,
        )
      : skipped("no-address");

    if (!outcome.ok) {
      log.error("[signup] verification link not delivered", {
        userId: user.id,
        reason: outcome.reason,
      });
    }

    // The flag reports what happened rather than being hardcoded true.
    // Fire-and-forget is still right here — a mail outage must not stop
    // somebody creating an account, and the link can be re-requested
    // from the account page — but the response should not claim a send
    // that did not occur, so a screen can offer "resend" instead of
    // "check your inbox".
    return ok({ user, verificationSent: outcome.ok }, 201);
  } catch (e) {
    log.error("[signup]", e);
    return err("حدث خطأ أثناء إنشاء الحساب", 500);
  }
}
