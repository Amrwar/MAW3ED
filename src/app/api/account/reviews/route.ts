import { db } from "@/lib/db";
import { ok, err, requireSession } from "@/lib/api";
import { getMyReviews } from "@/lib/account/queries";
import { log } from "@/lib/logger";

/**
 * GET /api/account/reviews
 *
 * The reviews this customer has written — the website's account page
 * (getMyReviews) over HTTP for the app. Found through the bookings they
 * were written for, by the account's verified phone, exactly as the
 * bookings themselves are.
 */
export async function GET() {
  try {
    const session = await requireSession();
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { phone: true, phoneVerifiedAt: true, historySince: true },
    });
    if (!user?.phone || !user.phoneVerifiedAt) return ok({ reviews: [], needsPhone: true });

    const rows = await getMyReviews(user.phone, user.historySince);
    return ok({
      needsPhone: false,
      reviews: rows.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        response: r.response,
        respondedAt: r.respondedAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
        business: r.business,
        date: r.booking.date.toISOString().slice(0, 10),
        serviceName: r.booking.service.nameAr,
      })),
    });
  } catch (e) {
    if (e instanceof Response) return e;
    log.error("[account reviews]", e);
    return err("حصلت مشكلة عندنا، جرّب تاني بعد شوية", 500);
  }
}
