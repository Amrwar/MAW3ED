import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ok, err } from "@/lib/api";
import { requireBusinessAccess } from "@/lib/business-access";
import { normalisePhone, PHONE_INVALID } from "@/lib/phone";
import { log } from "@/lib/logger";

type Params = { params: Promise<{ id: string }> };

/** One answer for every reason a number cannot be used, so none is revealed. */
const unavailable = () => err("الرقم ده مينفعش يتستخدم، اكتب رقم تاني", 409, { code: "phone-unavailable" });

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

    // A business's number — this one's or anybody else's — is not a staff
    // login: it would make an owner somebody's staff. Owners sign up by
    // email, so their account often has no phone; the business's own
    // phone and WhatsApp are what identify them. Stored as typed, so the
    // candidates are found by their last digits and compared normalised.
    const tail = phone.slice(-9);
    const businesses = await db.business.findMany({
      where: { OR: [{ phone: { contains: tail } }, { whatsapp: { contains: tail } }] },
      select: { id: true, phone: true, whatsapp: true },
    });
    const isBusinessNumber = businesses.filter((b) => normalisePhone(b.phone) === phone || normalisePhone(b.whatsapp) === phone);
    const owner = await db.user.findUnique({ where: { id: actor.userId }, select: { phone: true } });
    if (owner?.phone === phone || isBusinessNumber.some((b) => b.id === business.id)) {
      return err("ده رقم النشاط أو رقمك إنت، اكتب رقم الموظف", 422, { code: "own-phone" });
    }
    // Another owner's number, by account or by business: refused with the
    // same answer as a number already in use, so this form cannot be used
    // to find out whose number is whose.
    const ownsAccount = await db.user.findFirst({ where: { phone, business: { isNot: null } }, select: { id: true } });
    if (ownsAccount || isBusinessNumber.length > 0) return unavailable();

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
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return unavailable();
      throw e;
    }
  } catch (e) {
    if (e instanceof Response) return e;
    log.error("[staff access]", e);
    return err("حدث خطأ", 500);
  }
}
