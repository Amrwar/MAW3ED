import { db } from "@/lib/db";
import { ok, err, requireSession } from "@/lib/api";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { getFavorites, getHistory, getMyReviews, getPaymentHistory, getUpcoming } from "@/lib/account/queries";
import { log } from "@/lib/logger";

/**
 * GET /api/account/export
 *
 * A copy of everything the account can see about itself, as JSON: the
 * profile and its preferences, every booking (upcoming and past, under
 * the same fence as the account's own screens), payments, reviews and
 * saved places. The same data the pages show, in one document, for a
 * customer who asks for it — nothing a screen would not already give
 * them, and nothing about anybody else.
 *
 * Rate-limited per account; the response is marked as a download and
 * never cached.
 */
export async function GET() {
  try {
    const session = await requireSession();

    const limited = await rateLimit("accountExport", session.user.id);
    if (!limited.ok) return tooManyRequests(limited);

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        phone: true,
        phoneVerifiedAt: true,
        historySince: true,
        notifyByWhatsApp: true,
        notifyByEmail: true,
        notifyBySms: true,
        createdAt: true,
      },
    });
    if (!user) return err("سجّل دخولك الأول", 401);

    const phone = user.phone && user.phoneVerifiedAt ? user.phone : null;
    const since = user.historySince;

    const [upcoming, history, payments, reviews, favorites, notifications] = await Promise.all([
      phone ? getUpcoming(phone, since) : [],
      phone ? getHistory(phone, { take: 1000, since }) : { bookings: [], total: 0, nextCursor: null },
      phone ? getPaymentHistory(phone, since) : [],
      phone ? getMyReviews(phone, since) : [],
      getFavorites(user.id),
      db.notification.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 500,
        select: { kind: true, title: true, body: true, createdAt: true, readAt: true },
      }),
    ]);

    const body = {
      exportedAt: new Date().toISOString(),
      format: "maw3ed-account-export/1",
      profile: {
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified?.toISOString() ?? null,
        phone: user.phone,
        phoneVerifiedAt: user.phoneVerifiedAt?.toISOString() ?? null,
        createdAt: user.createdAt.toISOString(),
        historySince: since?.toISOString() ?? null,
        preferences: { whatsapp: user.notifyByWhatsApp, email: user.notifyByEmail, sms: user.notifyBySms },
      },
      bookings: { upcoming, past: history.bookings, pastTotal: history.total },
      payments,
      reviews,
      favorites: favorites.map((f) => ({ savedAt: f.createdAt.toISOString(), business: f.business })),
      notifications,
    };

    const res = ok(body);
    res.headers.set("Content-Disposition", `attachment; filename="maw3ed-account-${user.id}.json"`);
    res.headers.set("Cache-Control", "no-store, private");
    return res;
  } catch (e) {
    if (e instanceof Response) return e;
    log.error("[account export]", e);
    return err("حصلت مشكلة عندنا، جرّب تاني بعد شوية", 500);
  }
}
