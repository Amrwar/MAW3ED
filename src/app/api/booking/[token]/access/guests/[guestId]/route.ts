import { ok } from "@/lib/api";
import { log } from "@/lib/logger";
import { removeGuest } from "@/lib/access/passes";
import { bookingForToken, failure, isEnglish, limitWrites, refusal } from "@/lib/access/customer-routes";

type Params = { params: Promise<{ token: string; guestId: string }> };

/** DELETE /api/booking/:token/access/guests/:guestId — the guest's pass is withdrawn. */
export async function DELETE(req: Request, { params }: Params) {
  try {
    const { token, guestId } = await params;
    const en = isEnglish(req);
    const booking = await bookingForToken(token, en);
    await limitWrites(booking.id);
    const r = await removeGuest(booking.id, guestId);
    if (!r.ok) return refusal(r, en);
    return ok({ removed: true });
  } catch (e) {
    return failure("[booking guest remove]", e, log, isEnglish(req));
  }
}
