import { ok } from "@/lib/api";
import { log } from "@/lib/logger";
import { retryPass } from "@/lib/access/passes";
import { bookingForToken, failure, isEnglish, limitWrites, refusal } from "@/lib/access/customer-routes";

type Params = { params: Promise<{ token: string; guestId: string }> };

/**
 * POST /api/booking/:token/access/guests/:guestId/retry — ask the
 * provider again after a pass failed to issue (the holder's own pass
 * too: pass the holder's id). Bounded per pass.
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const { token, guestId } = await params;
    const en = isEnglish(req);
    const booking = await bookingForToken(token, en);
    await limitWrites(booking.id);
    const r = await retryPass(booking.id, guestId);
    if (!r.ok) return refusal(r, en);
    return ok({ retrying: true });
  } catch (e) {
    return failure("[booking pass retry]", e, log, isEnglish(req));
  }
}
