import { ok, err } from "@/lib/api";
import { requireBusinessAccess } from "@/lib/business-access";
import { businessHandle } from "@/lib/business/route";
import { normalisePhone } from "@/lib/phone";
import { spendableAt } from "@/lib/loyalty/ledger";
import { usableEntitlements } from "@/lib/entitlements/ledger";
import { wallToInstant } from "@/lib/bookings/instants";
import { timeToMinutes } from "@/lib/bookings/time";

/**
 * GET /api/business/wallet?phone=&serviceId=&date=&time= — at the desk:
 * what this number holds here that a booking could use (points, a
 * package session, a membership visit). Booking creators only.
 */
export async function GET(req: Request) {
  return businessHandle("desk wallet GET", async () => {
    const { business } = await requireBusinessAccess("bookings.create");
    const q = new URL(req.url).searchParams;
    const phone = normalisePhone(q.get("phone") ?? "");
    if (!phone) return err("رقم الموبايل غير صحيح", 422, { code: "invalid" });
    const serviceId = q.get("serviceId") ?? "";
    const date = q.get("date") ?? "";
    const time = q.get("time") ?? "";
    const held = await spendableAt(business.id, phone);
    const at = /^\d{4}-\d{2}-\d{2}$/.test(date) && /^\d{2}:\d{2}$/.test(time) ? wallToInstant(date, timeToMinutes(time)) : new Date();
    const entitlements = serviceId ? await usableEntitlements(business.id, phone, serviceId, at) : [];
    return ok({
      loyalty: held ? { programName: held.program.nameAr, available: held.available, redeemPoints: held.program.redeemPoints, redeemValueCents: held.program.redeemValueCents, maxRedeemPercent: held.program.maxRedeemPercent } : null,
      entitlements,
    });
  });
}
