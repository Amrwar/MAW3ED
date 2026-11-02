import { ok, err } from "@/lib/api";
import { log } from "@/lib/logger";
import { replaceCheckInCode } from "@/lib/access/check-in";
import { bookingForToken, failure, limitWrites } from "@/lib/access/customer-routes";
import { isEnglish } from "@/lib/lang";

type Params = { params: Promise<{ token: string }> };

/**
 * POST /api/booking/:token/access/check-in — a new check-in code. The
 * old one stops scanning at once (for a customer who shared a
 * screenshot by mistake). Only while the booking is confirmed.
 */
export async function POST(req: Request, { params }: Params) {
  const en = isEnglish(req);
  try {
    const { token } = await params;
    const booking = await bookingForToken(token, en);
    await limitWrites(booking.id);
    const next = await replaceCheckInCode(booking.id);
    if (!next) return err(en ? "A check-in code is not available for this booking right now" : "الكود ده مش متاح للحجز ده دلوقتي", 409, { code: "not-available" });
    return ok({ replaced: true, generation: next.generation });
  } catch (e) {
    return failure("[booking check-in replace]", e, log, en);
  }
}
