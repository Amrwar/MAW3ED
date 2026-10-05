import { db } from "@/lib/db";
import { ok, err, requireBusiness } from "@/lib/api";
import { log } from "@/lib/logger";
import { syncVerifiedBadge } from "@/lib/business-verification";
import { secretMatches, isExpired, PHONE_MAX_ATTEMPTS } from "@/lib/verification";

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
      await db.phoneVerification.delete({ where: { id: record.id } });
      return err("الكود انتهت صلاحيته — اطلب كود جديد", 410);
    }

    if (record.attempts >= PHONE_MAX_ATTEMPTS) {
      await db.phoneVerification.delete({ where: { id: record.id } });
      return err("حاولت كتير — اطلب كود جديد", 429);
    }

    if (!secretMatches(code, record.codeHash)) {
      await db.phoneVerification.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      const left = PHONE_MAX_ATTEMPTS - (record.attempts + 1);
      return err(`الكود غير صحيح — باقي ${left} محاولات`, 400);
    }

    await db.$transaction([
      db.business.update({
        where: { id: business.id },
        data: { phoneVerifiedAt: new Date(), whatsapp: record.phone },
      }),
      db.phoneVerification.deleteMany({ where: { businessId: business.id } }),
    ]);

    const verified = await syncVerifiedBadge(business.id);

    log.info("phone verified", { businessId: business.id, verified });
    return ok({ verified: true, badgeEarned: verified });
  } catch (e) {
    if (e instanceof Response) return e;
    log.error("[verify-phone/confirm]", e);
    return err("حدث خطأ، حاول مرة أخرى", 500);
  }
}
