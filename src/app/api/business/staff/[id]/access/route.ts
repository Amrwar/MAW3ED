import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ok, err } from "@/lib/api";
import { requireBusinessAccess } from "@/lib/business-access";
import { normalisePhone, PHONE_INVALID } from "@/lib/phone";
import { log } from "@/lib/logger";

type Params = { params: Promise<{ id: string }> };

const schema = z.object({
  /** Null takes access away. */
  access: z.enum(["MANAGER", "PROVIDER"]).nullable(),
  phone: z.string().trim().max(32).optional(),
});

/**
 * PUT /api/business/staff/[id]/access — the owner decides who on the team
 * may sign in to the business's app, and as what.
 *
 * Owner only. A phone is required to give access: whoever signs in with
 * it, verified by a one-time code, becomes this staff member. Changing
 * the phone, or taking access away, unlinks the account that had it, and
 * that person loses the business on their next request.
 */
export async function PUT(req: Request, { params }: Params) {
  try {
    const { business, actor } = await requireBusinessAccess("staff.manageAccess");
    const { id } = await params;

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return err(parsed.error.issues[0].message, 422, { code: "invalid" });

    const member = await db.staffMember.findFirst({ where: { id, businessId: business.id } });
    if (!member) return err("الموظف غير موجود", 404, { code: "not-found" });

    if (parsed.data.access === null) {
      await db.staffMember.update({ where: { id }, data: { access: null, loginPhone: null, userId: null } });
      return ok({ id, access: null, loginPhone: null, linked: false });
    }

    const phone = normalisePhone(parsed.data.phone ?? member.loginPhone);
    if (!phone) return err(PHONE_INVALID, 422, { code: "phone-invalid" });

    // The owner's own number would make the owner their own staff.
    const owner = await db.user.findUnique({ where: { id: actor.userId }, select: { phone: true } });
    if (owner?.phone === phone) return err("ده رقمك إنت، اكتب رقم الموظف", 422, { code: "own-phone" });

    // A number that already signs in as somebody's staff — or owns a
    // business — cannot be given a second place.
    const owns = await db.user.findFirst({ where: { phone, business: { isNot: null } }, select: { id: true } });
    if (owns) return err("الرقم ده بتاع صاحب نشاط تاني", 409, { code: "phone-owner" });

    const samePhone = phone === member.loginPhone;
    try {
      const updated = await db.staffMember.update({
        where: { id },
        data: {
          access: parsed.data.access,
          loginPhone: phone,
          // A new number is a new person: the old link ends.
          ...(samePhone ? {} : { userId: null }),
        },
        select: { id: true, access: true, loginPhone: true, userId: true },
      });
      return ok({ id: updated.id, access: updated.access, loginPhone: updated.loginPhone, linked: Boolean(updated.userId) });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        return err("الرقم ده مستخدم لموظف تاني", 409, { code: "phone-taken" });
      }
      throw e;
    }
  } catch (e) {
    if (e instanceof Response) return e;
    log.error("[staff access]", e);
    return err("حدث خطأ", 500);
  }
}
