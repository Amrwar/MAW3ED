import { db } from "@/lib/db";
import { ok, err, requireSession } from "@/lib/api";
import { getPaymentHistory } from "@/lib/account/queries";
import { log } from "@/lib/logger";

/**
 * GET /api/account/payments
 *
 * Deposits this customer has paid, with any refund recorded against
 * them — the website's account page (getPaymentHistory) for the app.
 * Read from the payment ledger; nothing is computed on the client.
 */
export async function GET() {
  try {
    const session = await requireSession();
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { phone: true, phoneVerifiedAt: true },
    });
    if (!user?.phone || !user.phoneVerifiedAt) return ok({ payments: [], needsPhone: true });

    return ok({ payments: await getPaymentHistory(user.phone), needsPhone: false });
  } catch (e) {
    if (e instanceof Response) return e;
    log.error("[account payments]", e);
    return err("حصلت مشكلة عندنا، جرّب تاني بعد شوية", 500);
  }
}
