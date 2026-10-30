import { db } from "@/lib/db";
import { ok, err, requireBusiness } from "@/lib/api";
import { log } from "@/lib/logger";
import { syncVerifiedBadge } from "@/lib/business-verification";
import { secretMatches, isExpired, PHONE_MAX_ATTEMPTS } from "@/lib/verification";
import { arCount } from "@/lib/fmt";

/**
 * POST /api/business/verify-phone/confirm
 * Body: { code }
 *
 * Checks a code against the stored hash in constant time, caps wrong
 * guesses so a six-digit code cannot be walked, and burns the record
 * either way once it is spent.
 */
export async function POST(req: Request) {
  try {
    const { business } = await requireBusiness();

    const body = await req.json().catch(() => null);
    const code = typeof body?.code === "string" ? body.code.trim() : "";
    if (!/^\d{6}$/.test(code)) return err("الكود لازم يكون 6 أرقام", 422);

    const record = await db.phoneVerification.findFirst({
      where: { businessId: business.id },
      orderBy: { createdAt: "desc" },
    });

    if (!record) return err("اطلب كود جديد الأول", 400);

    if (isExpired(record.expiresAt)) {
      await db.phoneVerification.deleteMany({ where: { id: record.id } });
      return err("الكود انتهت صلاحيته — اطلب كود جديد", 410);
    }

    // The attempt is spent before the comparison, in one conditional
    // statement. A read-then-increment let parallel guesses all see the
    // same count, so the cap only held against somebody polite enough
    // to guess one at a time.
    const claimed = await db.phoneVerification.updateMany({
      where: { id: record.id, attempts: { lt: PHONE_MAX_ATTEMPTS } },
      data: { attempts: { increment: 1 } },
    });
    if (claimed.count === 0) {
      await db.phoneVerification.deleteMany({ where: { id: record.id } });
      return err("حاولت كتير — اطلب كود جديد", 429);
    }

    if (!secretMatches(code, record.codeHash)) {
      const after = await db.phoneVerification.findUnique({
        where: { id: record.id },
        select: { attempts: true },
      });
      const left = Math.max(0, PHONE_MAX_ATTEMPTS - (after?.attempts ?? PHONE_MAX_ATTEMPTS));
      return err(`الكود غير صحيح — باقي ${arCount(left, { zero: "محاولات", one: "محاولة واحدة", two: "محاولتين", few: "محاولات", many: "محاولة" })}`, 400);
    }

    await db.$transaction([
      db.business.update({
        where: { id: business.id },
        data: { phoneVerifiedAt: new Date(), whatsapp: record.phone },
      }),
      db.phoneVerification.deleteMany({ where: { businessId: business.id } }),
    ]);

    // Contact verification, which the readiness checklist reads. It does
    // not award the public badge: that is identity verification by an
    // administrator (lib/business-verification.ts).
    await syncVerifiedBadge(business.id);

    log.info("phone verified", { businessId: business.id });
    return ok({ verified: true });
  } catch (e) {
    if (e instanceof Response) return e;
    log.error("[verify-phone/confirm]", e);
    return err("حدث خطأ، حاول مرة أخرى", 500);
  }
}
