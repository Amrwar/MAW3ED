import { db } from "@/lib/db";
import { ok, err, requireSession } from "@/lib/api";
import { log } from "@/lib/logger";

/**
 * GET /api/account/bookings/[id]
 *
 * The link to one of the signed-in customer's own bookings, by id.
 *
 * Push notifications carry a booking's id, never its access token — the
 * token is a secret and a push passes through Apple's and Google's
 * servers. A tapped notification asks here, over the app's own
 * authenticated connection, and gets the token only if the booking was
 * made under this account's verified phone: the same rule every other
 * account route uses to decide what is theirs.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await params;

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { phone: true, phoneVerifiedAt: true },
    });
    if (!user?.phone || !user.phoneVerifiedAt) return err("لم يتم العثور على هذا الحجز", 404);

    const booking = await db.booking.findFirst({
      where: { id, customerPhoneE164: user.phone },
      select: { accessToken: true },
    });
    // The same answer for "not yours" and "does not exist".
    if (!booking?.accessToken) return err("لم يتم العثور على هذا الحجز", 404);

    return ok({ accessToken: booking.accessToken });
  } catch (e) {
    if (e instanceof Response) return e;
    log.error("[account booking link]", e);
    return err("حصلت مشكلة عندنا، جرّب تاني بعد شوية", 500);
  }
}
