import { z } from "zod";
import { db } from "@/lib/db";
import { ok, err, requireSession } from "@/lib/api";
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
    const session = await requireSession();

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
    if (e instanceof Response) return e;
    log.error("[account profile PATCH]", e);
    return err("حدث خطأ أثناء الحفظ", 500);
  }
}

/**
 * GET /api/account/profile
 *
 * The details the account screen shows and the PATCH above edits.
 *
 * This did not exist. The file had only a PATCH, while the mobile app
 * called GET on it at every cold start — so the request 404'd, the app
 * read that as an expired session and signed the user out on every
 * launch. Identity and roles now live at GET /api/auth/mobile/me; this
 * answers the other question, which is what to put on the screen.
 *
 * The phone is returned but is not editable here, for the reason the
 * PATCH documents: it is the key every booking is found by.
 */
export async function GET() {
  try {
    const session = await requireSession();

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        phoneVerifiedAt: true,
        notifyByWhatsApp: true,
        notifyByEmail: true,
      },
    });
    if (!user) return err("غير مصرح", 401);

    return ok({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      // The screen needs to tell "no number" from "unverified number":
      // one asks them to add one, the other to confirm it.
      phoneVerified: Boolean(user.phone && user.phoneVerifiedAt),
      notifyByWhatsApp: user.notifyByWhatsApp,
      notifyByEmail: user.notifyByEmail,
    });
  } catch (e) {
    if (e instanceof Response) return e;
    log.error("[account profile GET]", e);
    return err("حصلت مشكلة عندنا، جرّب تاني بعد شوية", 500);
  }
}
