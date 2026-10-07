import { z } from "zod";
import { db } from "@/lib/db";
import { ok, err } from "@/lib/api";
import { log } from "@/lib/logger";
import { claimsForUser, issueTokens, readRefreshToken } from "@/lib/auth/mobile-token";

const schema = z.object({ refreshToken: z.string().min(10) });

/**
 * POST /api/auth/mobile/refresh
 *
 * Trade a refresh token for a new pair.
 *
 * The signature alone is not enough. The MobileSession row it names has
 * to still exist and not have expired, which is what makes signing out
 * on a lost phone actually end the session rather than merely remove
 * the app's copy of a token that still works.
 *
 * Claims are rebuilt from the database rather than carried over, so a
 * role granted or withdrawn since sign-in takes effect on the next
 * refresh instead of weeks later.
 */
export async function POST(req: Request) {
  try {
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return err("انتهت الجلسة، سجّل الدخول من تاني", 401);

    const read = await readRefreshToken(parsed.data.refreshToken);
    if (!read) return err("انتهت الجلسة، سجّل الدخول من تاني", 401);

    const session = await db.mobileSession.findUnique({
      where: { id: read.sessionId },
      select: { id: true, userId: true, expiresAt: true },
    });

    // Revoked, or belongs to somebody else, or simply old.
    if (!session || session.userId !== read.userId || session.expiresAt < new Date()) {
      return err("انتهت الجلسة، سجّل الدخول من تاني", 401);
    }

    const claims = await claimsForUser(session.userId);
    if (!claims) return err("انتهت الجلسة، سجّل الدخول من تاني", 401);

    await db.mobileSession.update({
      where: { id: session.id },
      data: { lastUsedAt: new Date() },
    });

    return ok(await issueTokens(claims, session.id));
  } catch (e) {
    log.error("[mobile refresh]", e);
    return err("حدث خطأ", 500);
  }
}
