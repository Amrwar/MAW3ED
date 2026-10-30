import { db } from "@/lib/db";
import { ok, err } from "@/lib/api";
import {
  REVIEW_WINDOW_DAYS,
  canEditReview,
  canReviewBooking,
  editDaysLeft,
  recomputeBusinessRating,
} from "@/lib/reviews";
import { log } from "@/lib/logger";

type Params = { params: Promise<{ token: string }> };

const MAX_COMMENT = 1000;
/** Enough to show the room; not an album. */
const MAX_PHOTOS = 4;

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

    const photos = Array.isArray((body as { photos?: unknown }).photos)
      ? ((body as { photos: unknown[] }).photos
          .filter((p): p is string => typeof p === "string" && /^https:\/\//.test(p))
          .slice(0, MAX_PHOTOS))
      : [];

    const booking = await db.booking.findUnique({
      where: { accessToken: token },
      select: {
        id: true,
        businessId: true,
        status: true,
        endsAt: true,
        startsAt: true,
        startTime: true,
        date: true,
        isTest: true,
        review: { select: { id: true } },
      },
    });

    // Same message whether the token is wrong or the booking is gone:
    // a 404 that distinguishes them is a way to probe for valid tokens.
    if (!booking) return err("لم يتم العثور على هذا الحجز", 404);
    // An owner's test booking is not a customer's visit: a rating from
    // it would be the business rating itself.
    if (booking.isTest) return err("الحجز التجريبي مش بيتقيّم", 409, { code: "test-booking" });

    const check = canReviewBooking(booking);
    if (!check.allowed) {
      if (check.reason === "already-reviewed") return err("تم تقييم هذا الحجز من قبل", 409);
      // Marked completed ahead of time: there was no visit yet to review.
      if (check.reason === "too-early") {
        return err("التقييم متاح بعد ميعاد الحجز", 409, { code: "too-early" });
      }
      if (check.reason === "too-late") {
        return err(`التقييم بيتقفل بعد ${REVIEW_WINDOW_DAYS} يوم من الموعد`, 409);
      }
      return err("التقييم متاح بعد ما الموعد يكتمل", 409);
    }

    await db.review.create({
      data: { bookingId: booking.id, businessId: booking.businessId, rating, comment, photos },
    });

    // The listing reads a column, not the table, so it has to be told.
    await recomputeBusinessRating(booking.businessId);

    return ok({ created: true }, 201);
  } catch (e) {
    log.error("[booking review]", e);
    return err("حدث خطأ أثناء حفظ التقييم", 500);
  }
}

/**
 * PATCH /api/public/booking/[token]/review
 *
 * The author rewrites what they said.
 *
 * Within fourteen days of posting, and only while a moderator has not
 * acted on it — letting somebody rewrite a hidden review would be a way
 * to launder it back into view. See lib/review-policy for why the
 * window is what it is.
 *
 * The rating may change, so the business's average is recomputed.
 */
export async function PATCH(req: Request, { params }: Params) {
  try {
    const { token } = await params;
    if (!token || token.length < 16) return err("رابط غير صالح", 400);

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return err("بيانات غير صالحة", 400);

    const booking = await db.booking.findUnique({
      where: { accessToken: token },
      select: {
        businessId: true,
        review: { select: { id: true, createdAt: true, status: true, rating: true } },
      },
    });
    if (!booking?.review) return err("لم يتم العثور على هذا التقييم", 404);

    const may = canEditReview(booking.review);
    if (!may.allowed) {
      return err(
        may.reason === "window-closed"
          ? "مش هينفع تعدّل التقييم بعد مرور المدة"
          : may.reason === "withdrawn"
            ? "التقييم ده اتسحب"
            : "التقييم ده تحت المراجعة",
        409,
      );
    }

    const rawRating = (body as { rating?: unknown }).rating;
    const rating = rawRating === undefined ? booking.review.rating : Number(rawRating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return err("التقييم لازم يكون من 1 لـ 5", 422);
    }

    const rawComment = (body as { comment?: unknown }).comment;
    const comment =
      rawComment === undefined
        ? undefined
        : typeof rawComment === "string" && rawComment.trim()
          ? rawComment.trim().slice(0, MAX_COMMENT)
          : null;

    const updated = await db.review.update({
      where: { id: booking.review.id },
      data: {
        rating,
        ...(comment !== undefined ? { comment } : {}),
        // Stamped so the page can say the review was edited, rather
        // than quietly showing different words than people voted on.
        editedAt: new Date(),
      },
      select: { id: true, rating: true, comment: true, editedAt: true },
    });

    await recomputeBusinessRating(booking.businessId);

    return ok({ ...updated, daysLeft: editDaysLeft(booking.review.createdAt) });
  } catch (e) {
    log.error("[booking review PATCH]", e);
    return err("حدث خطأ أثناء التعديل", 500);
  }
}

/**
 * DELETE /api/public/booking/[token]/review
 *
 * The author withdraws it.
 *
 * The row stays, marked REMOVED. It stops appearing and stops counting,
 * but the one-review-per-booking constraint still holds — so withdrawing
 * cannot be used to post a second review of the same visit — and a
 * moderator still has something to look at when a business asks why a
 * review disappeared.
 */
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { token } = await params;
    if (!token || token.length < 16) return err("رابط غير صالح", 400);

    const booking = await db.booking.findUnique({
      where: { accessToken: token },
      select: {
        businessId: true,
        review: { select: { id: true, createdAt: true, status: true } },
      },
    });
    if (!booking?.review) return err("لم يتم العثور على هذا التقييم", 404);

    const may = canEditReview(booking.review);
    if (!may.allowed) {
      return err(
        may.reason === "window-closed"
          ? "مش هينفع تسحب التقييم بعد مرور المدة"
          : "التقييم ده مش قابل للسحب",
        409,
      );
    }

    await db.review.update({
      where: { id: booking.review.id },
      data: { status: "REMOVED" },
    });

    // It no longer counts, so the average has to be told.
    await recomputeBusinessRating(booking.businessId);

    return ok({ withdrawn: true });
  } catch (e) {
    log.error("[booking review DELETE]", e);
    return err("حصلت مشكلة عندنا، جرّب تاني بعد شوية", 500);
  }
}
