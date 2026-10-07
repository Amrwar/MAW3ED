import bcrypt from "bcryptjs";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import { ok, err } from "@/lib/api";
import { z } from "zod";
import { log } from "@/lib/logger";

const schema = z.object({
  token:    z.string().min(1),
  password: z.string().min(8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل"),
});

/**
 * POST /api/auth/reset-password
 * Body: { token, password }
 *
 * Validates the reset token, hashes the new password, updates the user record,
 * and deletes the token (single-use). Expired tokens are rejected.
 */
export async function POST(req: Request) {
  try {
    // Keyed on the caller when no account is named yet. 429 with
    // Retry-After, and a message that says nothing about whether
    // the account exists.
    const limited = await rateLimit("resetPassword");
    if (!limited.ok) return tooManyRequests(limited);

    const body   = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return err(parsed.error.issues[0].message, 422);

    const { token, password } = parsed.data;

    const record = await db.passwordResetToken.findUnique({ where: { token } });

    if (!record)                        return err("الرابط غير صالح أو منتهي الصلاحية", 400);
    if (record.expiresAt < new Date())  return err("انتهت صلاحية هذا الرابط، أرسل طلبًا جديدًا", 400);

    const hashed = await bcrypt.hash(password, 12);

    await db.$transaction([
      db.user.update({
        where: { email: record.email },
        data:  { password: hashed },
      }),
      db.passwordResetToken.delete({ where: { token } }),
    ]);

    return ok({ reset: true });
  } catch (e) {
    log.error("[reset-password]", e);
    return err("حدث خطأ، حاول مرة أخرى", 500);
  }
}
