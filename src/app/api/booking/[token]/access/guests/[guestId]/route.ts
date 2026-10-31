import { ok } from "@/lib/api";
import { log } from "@/lib/logger";
import { removeGuest } from "@/lib/access/passes";
import { bookingForToken, failure, limitWrites, refusal } from "@/lib/access/customer-routes";

type Params = { params: Promise<{ token: string; guestId: string }> };

/** DELETE /api/booking/:token/access/guests/:guestId — the guest's pass is withdrawn. */
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { token, guestId } = await params;
    const booking = await bookingForToken(token);
    await limitWrites(booking.id);
    const r = await removeGuest(booking.id, guestId);
    if (!r.ok) return refusal(r);
    return ok({ removed: true });
  } catch (e) {
    return failure("[booking guest remove]", e, log);
  }
}
