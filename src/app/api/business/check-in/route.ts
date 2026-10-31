import { z } from "zod";
import { ok, err } from "@/lib/api";
import { log } from "@/lib/logger";
import { bookingScope, can, requireBusinessAccess } from "@/lib/business-access";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { checkIn, lookupScan, withoutId } from "@/lib/access/check-in";

const schema = z.object({
  code: z.string().trim().min(1).max(500),
  action: z.enum(["verify", "check-in"]).default("verify"),
});

/**
 * POST /api/business/check-in { code, action: "verify" | "check-in" }
 *
 * The front desk scans a customer's booking QR (or pastes the code).
 * "verify" says what the code is — the booking, if it is in this
 * caller's diary, and whether it can be checked in now; "check-in"
 * marks the customer arrived (CONFIRMED → ARRIVED), idempotently.
 *
 * Only within what the caller may see (lib/business-access bookingScope):
 * another business's code, or a colleague's booking for a provider, is
 * "not-found" — the same answer as a code that never existed. Checking
 * in needs bookings.progress, as marking arrived by hand does.
 */
export async function POST(req: Request) {
  try {
    const { business, actor } = await requireBusinessAccess("bookings.read");
    const limited = await rateLimit("accessScan", `user:${actor.userId}`);
    if (!limited.ok) return tooManyRequests(limited);

    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return err("الكود غير صالح", 422);
    const scope = bookingScope(business, actor);

    if (parsed.data.action === "check-in") {
      if (!can(actor, "bookings.progress")) return err("مش مسموح لك بالإجراء ده", 403, { code: "forbidden" });
      return ok(await checkIn(parsed.data.code, scope, actor.userId));
    }
    const result = withoutId(await lookupScan(parsed.data.code, scope));
    return ok({ ...result, canCheckIn: result.state === "valid" && can(actor, "bookings.progress") });
  } catch (e) {
    if (e instanceof Response) return e;
    log.error("[business check-in]", e);
    return err("حصلت مشكلة عندنا، جرّب تاني بعد شوية", 500);
  }
}
