import { z } from "zod";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { ok, err } from "@/lib/api";
import { log } from "@/lib/logger";

const patchSchema = z.object({
  name: z.string().trim().max(80).nullable().optional(),
  email: z.string().trim().email().nullable().optional().or(z.literal("")),
  notifyByWhatsApp: z.boolean().optional(),
  notifyByEmail: z.boolean().optional(),
});

/**
 * PATCH /api/account/profile
 *
 * The phone is deliberately not editable: it is the key every booking
 * is found by, so changing it here would silently detach a customer's
 * history. Moving to a new number means proving the new one.
 */
export async function PATCH(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return err("غير مصرح", 401);

    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) return err(parsed.error.issues[0].message, 422);

    const { name, email, notifyByWhatsApp, notifyByEmail } = parsed.data;
    const normalisedEmail = email === "" ? null : email;

    if (normalisedEmail) {
      const taken = await db.user.findFirst({
        where: { email: normalisedEmail, id: { not: session.user.id } },
        select: { id: true },
      });
      if (taken) return err("البريد ده مستخدم في حساب تاني", 409);
    }

    const user = await db.user.update({
      where: { id: session.user.id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(email !== undefined ? { email: normalisedEmail } : {}),
        ...(notifyByWhatsApp !== undefined ? { notifyByWhatsApp } : {}),
        ...(notifyByEmail !== undefined ? { notifyByEmail } : {}),
      },
      select: { id: true, name: true, email: true, notifyByWhatsApp: true, notifyByEmail: true },
    });

    return ok({ user });
  } catch (e) {
    log.error("[account profile PATCH]", e);
    return err("حدث خطأ أثناء الحفظ", 500);
  }
}
