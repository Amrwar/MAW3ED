import { ok } from "@/lib/api";
import { log } from "@/lib/logger";
import { requestPass } from "@/lib/access/passes";
import { visitorPhone, visitorSchema } from "@/lib/access/customer";
import { bookingForToken, failure, invalidPhone, invalidVisitor, isEnglish, limitWrites, refusal } from "@/lib/access/customer-routes";

type Params = { params: Promise<{ token: string }> };

/**
 * POST /api/booking/:token/access/pass { displayName, phone? }
 *
 * The booking holder asks the venue for their own visitor pass. A
 * confirmed booking does not issue one by itself: this asks, the venue's
 * access provider decides, and the pass shows as pending until it does.
 * Idempotent: asking again updates the name and changes nothing else.
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const { token } = await params;
    const en = isEnglish(req);
    const booking = await bookingForToken(token, en);
    await limitWrites(booking.id);
    const parsed = visitorSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return invalidVisitor(parsed.error.issues[0]?.message, en);
    const phone = visitorPhone(parsed.data.phone ?? booking.customerPhoneE164);
    if (phone === "invalid") return invalidPhone(en);
    const r = await requestPass(booking.id, { displayName: parsed.data.displayName, phoneE164: phone, userId: booking.userId });
    if (!r.ok) return refusal(r, en);
    return ok({ requested: true });
  } catch (e) {
    return failure("[booking pass request]", e, log, isEnglish(req));
  }
}
