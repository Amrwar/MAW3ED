import { z } from "zod";
import { ok, err, requireBusiness } from "@/lib/api";
import { businessHandle, readJson } from "@/lib/business/route";
import { normalisePhone } from "@/lib/phone";
import { sellMembership, sellPackage } from "@/lib/entitlements/ledger";

/**
 * POST /api/business/packages/sell — a package or a membership sold at the
 * desk, paid in person (cash or card at the counter). Recorded as a
 * MANUAL payment with a receipt number. The number is the customer's
 * key: the package is used by bookings under it.
 */
const body = z.object({
  kind: z.enum(["package", "membership"]),
  planId: z.string().min(1).max(40),
  phone: z.string().min(5).max(40),
  customerName: z.string().trim().min(2).max(120),
  method: z.enum(["CASH", "CARD", "WALLET", "OTHER"]),
});

export async function POST(req: Request) {
  return businessHandle("entitlement sell", async () => {
    const { session, business } = await requireBusiness();
    const parsed = body.safeParse(await readJson(req));
    if (!parsed.success) return err(parsed.error.issues[0].message, 422, { code: "invalid" });
    const phone = normalisePhone(parsed.data.phone);
    if (!phone) return err("رقم الموبايل غير صحيح", 422, { code: "invalid", field: "phone" });
    const sale = {
      businessId: business.id,
      planId: parsed.data.planId,
      phoneE164: phone,
      customerName: parsed.data.customerName,
      method: parsed.data.method,
      recordedById: session.user.id,
    };
    const r = parsed.data.kind === "package" ? await sellPackage(sale) : await sellMembership(sale);
    if (!r.ok) return err(r.why === "plan-inactive" ? "الخطة دي موقوفة" : "الخطة غير موجودة", r.why === "plan-inactive" ? 409 : 404, { code: r.why });
    return ok(r.value, 201);
  });
}
