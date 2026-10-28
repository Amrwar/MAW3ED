import { z } from "zod";
import { db } from "@/lib/db";
import { ok, err, requireSession } from "@/lib/api";
import { log } from "@/lib/logger";
import { siteUrl } from "@/lib/env";
import { sendEmailVerification, isEmailEnabled } from "@/lib/services/email";
import { pendingEmailFor } from "@/lib/account/pending-email";
import {
  generateEmailToken,
  hashSecret,
  cooledDown,
  EMAIL_TOKEN_TTL_MS,
  EMAIL_RESEND_COOLDOWN_MS,
} from "@/lib/verification";

const patchSchema = z.object({
  name: z.string().trim().max(80).nullable().optional(),
  email: z.string().trim().toLowerCase().email().nullable().optional().or(z.literal("")),
  notifyByWhatsApp: z.boolean().optional(),
  notifyByEmail: z.boolean().optional(),
});

/**
 * PATCH /api/account/profile
 *
 * The phone is deliberately not editable: it is the key every booking
 * is found by, so changing it here would silently detach a customer's
 * history. Moving to a new number means proving the new one.
 *
 * The email is editable, but a new address does not become the
 * account's until a link sent to it is followed. It used to be written
 * at once, unverified, which let anybody with a phone-code account
 * claim an address — a business owner's, say, before the owner had
 * signed up — and then take over whatever that address later signed
 * up for. Until the link is followed the old address stays; the
 * response carries the pending one so the screen can say so.
 *
 * The other fields are saved first, whatever happens to the email: a
 * throttled link must not lose a corrected name. Saving the current
 * address again, or removing it, withdraws any change still waiting.
 */
export async function PATCH(req: Request) {
  try {
    const session = await requireSession();
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) return err(parsed.error.issues[0].message, 422);

    const { name, email, notifyByWhatsApp, notifyByEmail } = parsed.data;
    const current = await db.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, name: true, email: true },
    });
    if (!current) return err("غير مصرح", 401);

    const next = email === undefined ? undefined : email ? email : null;
    const unchanged = next === undefined || next === (current.email?.toLowerCase() ?? null);

    const data: { name?: string | null; email?: null; emailVerified?: null; notifyByWhatsApp?: boolean; notifyByEmail?: boolean } = {};
    if (name !== undefined) data.name = name;
    if (notifyByWhatsApp !== undefined) data.notifyByWhatsApp = notifyByWhatsApp;
    if (notifyByEmail !== undefined) data.notifyByEmail = notifyByEmail;
    if (!unchanged && next === null) {
      // Removing the address: nothing to prove.
      data.email = null;
      data.emailVerified = null;
    }
    if (Object.keys(data).length > 0) {
      await db.user.update({ where: { id: current.id }, data });
    }

    if (next !== undefined && (unchanged || next === null)) {
      // The address on file is the one they want: any change still
      // waiting on its link is withdrawn, or the link could later move
      // the account to an address they decided against.
      await db.emailVerificationToken.deleteMany({ where: { userId: current.id, email: { not: null } } });
    }

    if (!unchanged && next) {
      const taken = await db.user.findFirst({
        where: { email: { equals: next, mode: "insensitive" }, id: { not: current.id } },
        select: { id: true },
      });
      if (taken) return err("البريد ده مستخدم في حساب تاني", 409);

      if (!isEmailEnabled()) {
        log.error("[account profile] no mail provider; email change refused");
        return err("خدمة البريد غير متاحة حالياً، حاول تاني بعد شوية", 503);
      }
      // Throttled on change links only: the link signup sent to the
      // old address is not one they asked for here.
      const recent = await db.emailVerificationToken.findFirst({
        where: { userId: current.id, email: { not: null } },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });
      if (recent && !cooledDown(recent.createdAt, EMAIL_RESEND_COOLDOWN_MS)) {
        return err("انتظر دقيقة قبل طلب رابط جديد", 429);
      }
      // One change waiting at a time, carrying the address it proves.
      await db.emailVerificationToken.deleteMany({ where: { userId: current.id, email: { not: null } } });
      const token = generateEmailToken();
      const created = await db.emailVerificationToken.create({
        data: {
          userId: current.id,
          email: next,
          tokenHash: hashSecret(token),
          expiresAt: new Date(Date.now() + EMAIL_TOKEN_TTL_MS),
        },
        select: { id: true },
      });
      const outcome = await sendEmailVerification(
        next,
        `${siteUrl}/api/auth/verify-email/confirm?token=${token}`,
        name ?? current.name,
      );
      if (!outcome.ok) {
        // No link went out, so nothing is pending.
        await db.emailVerificationToken.delete({ where: { id: created.id } }).catch(() => {});
        log.error("[account profile] confirmation not sent", { userId: current.id, reason: outcome.reason });
        return err("ما قدرناش نبعت رابط التأكيد. حاول تاني بعد شوية.", 502);
      }
    }

    const user = await db.user.findUnique({
      where: { id: current.id },
      select: { id: true, name: true, email: true, notifyByWhatsApp: true, notifyByEmail: true },
    });
    if (!user) return err("غير مصرح", 401);
    return ok({ user, pendingEmail: await pendingEmailFor(user.id, user.email) });
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
      // An address waiting on its link, so the screen can say so
      // instead of showing the old one as if nothing happened.
      pendingEmail: await pendingEmailFor(user.id, user.email),
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
