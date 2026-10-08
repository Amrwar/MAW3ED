import { db } from "@/lib/db";
import { ok, err, requireSession } from "@/lib/api";
import { getUpcoming, getHistory } from "@/lib/account/queries";
import { log } from "@/lib/logger";

/**
 * GET /api/account/bookings?scope=upcoming|history&take=&skip=
 *
 * A customer's own appointments.
 *
 * The website never needed this: its account pages are server
 * components that call getUpcoming and getHistory directly. The mobile
 * app cannot, so this is the same two functions over HTTP — not a
 * second implementation. If the rules about what counts as "upcoming"
 * change, they change in one place and both clients follow.
 *
 * Bookings are found by the customer's verified phone, not their user
 * id, because that is how they are stored: a booking records the number
 * that made it, and customerPhoneE164 is a generated column so a number
 * typed 01107578212 one day and +20 110 757 8212 the next still matches.
 * An account with no verified phone therefore has no bookings to show —
 * which is the honest answer, not an error.
 */
export async function GET(req: Request) {
  try {
    const session = await requireSession();

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { phone: true, phoneVerifiedAt: true },
    });

    // An owner who signed up with an email has no verified phone. They
    // have no customer bookings, and saying so plainly is better than
    // a 404 the app would have to interpret.
    if (!user?.phone || !user.phoneVerifiedAt) {
      return ok({ bookings: [], total: 0, needsPhone: true });
    }

    const url = new URL(req.url);
    const scope = url.searchParams.get("scope") === "history" ? "history" : "upcoming";

    if (scope === "upcoming") {
      const bookings = await getUpcoming(user.phone);
      // No total: "upcoming" is the whole list, never a page of one.
      return ok({ bookings, total: bookings.length, needsPhone: false });
    }

    // History can be long, so it pages. The ceiling is here rather than
    // trusting the caller: an app asking for everything at once is a
    // bug on a phone, and a stranger asking for it is worse.
    const take = Math.min(Math.max(Number(url.searchParams.get("take")) || 20, 1), 50);
    const skip = Math.max(Number(url.searchParams.get("skip")) || 0, 0);

    const { bookings, total } = await getHistory(user.phone, { take, skip });
    return ok({ bookings, total, needsPhone: false });
  } catch (e) {
    if (e instanceof Response) return e;
    log.error("[account bookings]", e);
    return err("حدث خطأ", 500);
  }
}
