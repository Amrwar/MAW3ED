import { ok, err } from "@/lib/api";
import { log } from "@/lib/logger";
import { customerAccessPayload } from "@/lib/access/customer";
import { bookingForToken, failure } from "@/lib/access/customer-routes";
import { isEnglish } from "@/lib/lang";

type Params = { params: Promise<{ token: string }> };

/**
 * GET /api/booking/:token/access[?lang=en]
 *
 * The booking's check-in QR and, where the venue offers them, its
 * visitor passes — what the booking page and the app show
 * (lib/access/customer.ts).
 */
export async function GET(req: Request, { params }: Params) {
  const en = isEnglish(req);
  try {
    const { token } = await params;
    const booking = await bookingForToken(token, en);
    const payload = await customerAccessPayload(booking.id, en);
    if (!payload) return err(en ? "Booking not found" : "الحجز غير موجود", 404, { code: "not-found" });
    return ok(payload);
  } catch (e) {
    return failure("[booking access GET]", e, log, en);
  }
}
