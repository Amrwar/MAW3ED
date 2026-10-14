import { z } from "zod";
import { db } from "@/lib/db";
import { ok, err } from "@/lib/api";
import { log } from "@/lib/logger";
import { readRefreshToken } from "@/lib/auth/mobile-token";

const schema = z.object({ refreshToken: z.string().min(10) });

/**
 * POST /api/auth/mobile/logout
 *
 * End this device's session.
 *
 * Deletes the MobileSession row, so the refresh token stops working
 * even though its signature stays valid. The access token lives out its
 * remaining minutes — revoking those too would mean a database read on
 * every request, which is the cost the short lifetime exists to avoid.
 *
 * Always answers 200. A sign-out that reports failure leaves somebody
 * unsure whether they are signed out, and there is nothing they could
 * do about it; the app clears its storage either way.
 */
export async function POST(req: Request) {
  try {
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return ok({ ended: false });

    const read = await readRefreshToken(parsed.data.refreshToken);
    if (!read) return ok({ ended: false });

    // Scoped to the user the token names, so a stolen session id cannot
    // be used to end somebody else's session.
    await db.mobileSession.deleteMany({
      where: { id: read.sessionId, userId: read.userId },
    });

    return ok({ ended: true });
  } catch (e) {
    log.error("[mobile logout]", e);
    return err("حصلت مشكلة عندنا، جرّب تاني بعد شوية", 500);
  }
}
