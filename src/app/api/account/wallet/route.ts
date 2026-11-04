import { db } from "@/lib/db";
import { ok, err, requireSession } from "@/lib/api";
import { log } from "@/lib/logger";
import { walletFor } from "@/lib/account/wallet";
import { spendableAt } from "@/lib/loyalty/ledger";
import { usableEntitlements } from "@/lib/entitlements/ledger";
import { redemptionFor } from "@/lib/loyalty/rules";
import { wallToInstant } from "@/lib/bookings/instants";
import { timeToMinutes } from "@/lib/bookings/time";
import { toCents } from "@/lib/payments/money";

/**
 * GET /api/account/wallet — the signed-in customer's points, packages and
 * memberships, under their verified number only (an unverified number
 * shows nothing: anybody can type one).
 *
 * With ?slug=&serviceId=&date=&time=, also what a booking there could
 * use — the booking page offers exactly these, and the booking route
 * checks them again inside its transaction.
 */
export async function GET(req: Request) {
  try {
    const session = await requireSession();
    const user = await db.user.findUnique({ where: { id: session.user.id }, select: { phone: true, phoneVerifiedAt: true } });
    if (!user?.phone || !user.phoneVerifiedAt) return ok({ verified: false, loyalty: [], packages: [], memberships: [], usable: null });

    const q = new URL(req.url).searchParams;
    const slug = q.get("slug");
    let usable = null;
    if (slug) {
      const business = await db.business.findFirst({ where: { slug, isPublished: true }, select: { id: true } });
      const serviceId = q.get("serviceId") ?? "";
      const date = q.get("date") ?? "";
      const time = q.get("time") ?? "";
      const service = business && serviceId
        ? await db.service.findFirst({ where: { id: serviceId, businessId: business.id }, select: { price: true } })
        : null;
      if (business && service) {
        const at = /^\d{4}-\d{2}-\d{2}$/.test(date) && /^\d{2}:\d{2}$/.test(time) ? wallToInstant(date, timeToMinutes(time)) : new Date();
        const held = await spendableAt(business.id, user.phone);
        const priceCents = toCents(service.price);
        const best = held ? redemptionFor(held.program, held.available, held.available, priceCents) : null;
        usable = {
          loyalty: held ? { programName: held.program.nameAr, available: held.available, maxPoints: best?.points ?? 0, maxOffCents: best?.amountCents ?? 0, redeemPoints: held.program.redeemPoints, redeemValueCents: held.program.redeemValueCents } : null,
          entitlements: await usableEntitlements(business.id, user.phone, serviceId, at),
        };
      }
    }
    return ok({ verified: true, ...(await walletFor(user.phone)), usable });
  } catch (e) {
    if (e instanceof Response) return e;
    log.error("[account wallet GET]", e);
    return err("حصلت مشكلة عندنا، جرّب تاني بعد شوية", 500);
  }
}
