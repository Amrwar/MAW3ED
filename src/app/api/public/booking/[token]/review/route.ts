import { db } from "@/lib/db";
import { ok, err } from "@/lib/api";
import { canReviewBooking, recomputeBusinessRating } from "@/lib/reviews";
import { log } from "@/lib/logger";

type Params = { params: Promise<{ token: string }> };

const MAX_COMMENT = 1000;

/**
 * POST /api/public/booking/[token]/review
 *
 * The customer rates the appointment they actually attended.
 *
 * The token is the authorisation: it was generated per booking and
 * only ever sent to the person who made it. No session is involved,
 * which is deliberate — most customers book without an account.
 *
 * A review can only be left against a COMPLETED booking, and only
 * once. The second rule is enforced by a unique constraint on
 * Review.bookingId as well as by the check here, so two simultaneous
 * submissions cannot both win.
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const { token } = await params;
    if (!token || token.length < 16) return err("رابط غير صالح", 400);

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return err("بيانات غير صالحة", 400);

    const rating = Number((body as { rating?: unknown }).rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return err("التقييم لازم يكون من 1 لـ 5", 422);
    }

    const rawComment = (body as { comment?: unknown }).comment;
    const comment =
      typeof rawComment === "string" && rawComment.trim()
        ? rawComment.trim().slice(0, MAX_COMMENT)
        : null;

    const booking = await db.booking.findUnique({
      where: { accessToken: token },
      select: { id: true, businessId: true, status: true, review: { select: { id: true } } },
    });

    // Same message whether the token is wrong or the booking is gone:
    // a 404 that distinguishes them is a way to probe for valid tokens.
    if (!booking) return err("لم يتم العثور على هذا الحجز", 404);

    const check = canReviewBooking(booking);
    if (!check.allowed) {
      return check.reason === "already-reviewed"
        ? err("تم تقييم هذا الحجز من قبل", 409)
        : err("التقييم متاح بعد ما الموعد يكتمل", 409);
    }

    await db.review.create({
      data: { bookingId: booking.id, businessId: booking.businessId, rating, comment },
    });

    // The listing reads a column, not the table, so it has to be told.
    await recomputeBusinessRating(booking.businessId);

    return ok({ created: true }, 201);
  } catch (e) {
    log.error("[booking review]", e);
    return err("حدث خطأ أثناء حفظ التقييم", 500);
  }
}
