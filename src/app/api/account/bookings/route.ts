import { z } from "zod";
import { db } from "@/lib/db";
import { ok, err, requireSession } from "@/lib/api";
import { decodeHistoryCursor, getUpcoming, getHistory } from "@/lib/account/queries";
import { log } from "@/lib/logger";
import { parseQuery } from "@/lib/query-params";

/**
 * take is 1..50 (more is clamped to 50, as it always was); skip is a
 * whole number. Anything else is a 400 rather than a silent default.
 */
const query = z.object({
  scope: z.enum(["upcoming", "history"]).optional(),
  take: z.coerce.number().int().min(1).transform((n) => Math.min(n, 50)).optional(),
  skip: z.coerce.number().int().min(0).max(1_000_000).optional(),
  /** nextCursor from the previous history page; when given, skip is ignored. */
  cursor: z.string().max(300).refine((c) => decodeHistoryCursor(c) !== null, "invalid cursor").optional(),
});

/**
 * GET /api/account/bookings?scope=upcoming|history&take=&skip=&cursor=
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

    const q = parseQuery(new URL(req.url).searchParams, query);
    if (!q.ok) return q.response;
    const scope = q.data.scope ?? "upcoming";

    if (scope === "upcoming") {
      const bookings = await getUpcoming(user.phone);
      // No total: "upcoming" is the whole list, never a page of one.
      return ok({ bookings, total: bookings.length, needsPhone: false });
    }

    // History can be long, so it pages. The ceiling is here rather than
    // trusting the caller: an app asking for everything at once is a
    // bug on a phone, and a stranger asking for it is worse.
    const take = q.data.take ?? 20;
    const skip = q.data.skip ?? 0;

    // nextCursor is additive: a client paging by skip ignores it, one
    // passing it back as `cursor` gets pages that do not shift when a
    // booking moves into history mid-scroll. null on the last page.
    const { bookings, total, nextCursor } = await getHistory(user.phone, { take, skip, cursor: q.data.cursor });
    return ok({ bookings, total, nextCursor, needsPhone: false });
  } catch (e) {
    if (e instanceof Response) return e;
    log.error("[account bookings]", e);
    return err("حصلت مشكلة عندنا، جرّب تاني بعد شوية", 500);
  }
}
