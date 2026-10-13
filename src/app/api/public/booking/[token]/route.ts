import { err } from "@/lib/api";
import { getPublicBooking } from "@/lib/bookings/public-view";
import { log } from "@/lib/logger";

type Params = { params: Promise<{ token: string }> };

/**
 * GET /api/public/booking/[token]
 *
 * A booking's current state, for the app — the JSON twin of the
 * /booking/[token] page, with the same token as its authorisation.
 *
 * The app polls this after a deposit payment and before it draws a
 * confirmation: the webhook decides whether a booking is confirmed, and
 * this is where the app learns what it decided.
 */
export async function GET(_req: Request, { params }: Params) {
  try {
    const { token } = await params;
    if (!token || token.length < 16) return err("رابط غير صالح", 400);

    const booking = await getPublicBooking(token);
    if (!booking) return err("لم يتم العثور على هذا الحجز", 404);

    return Response.json(booking, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    log.error("[public booking GET]", e);
    return err("حدث خطأ", 500);
  }
}
