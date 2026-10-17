import { z } from "zod";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { ok, err } from "@/lib/api";
import { log } from "@/lib/logger";
import { readRefreshToken } from "@/lib/auth/mobile-token";
import { rotateRefresh } from "@/lib/auth/mobile-refresh";

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
 *
 * Each refresh token works once; presenting a spent one revokes the
 * session. See lib/auth/mobile-refresh.ts.
 */
export async function POST(req: Request) {
  try {
    // Keyed on the caller when no account is named yet. 429 with
    // Retry-After, and a message that says nothing about whether
    // the account exists.
    const limited = await rateLimit("mobileRefresh");
    if (!limited.ok) return tooManyRequests(limited);

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return err("انتهت الجلسة، سجّل الدخول من تاني", 401);

    const read = await readRefreshToken(parsed.data.refreshToken);
    if (!read) return err("انتهت الجلسة، سجّل الدخول من تاني", 401);

    const result = await rotateRefresh(read);
    // Expired, revoked and reused all get the same answer: the app's
    // only move in each case is to sign in again.
    if (!result.ok) return err("انتهت الجلسة، سجّل الدخول من تاني", 401);

    return ok(result.tokens);
  } catch (e) {
    log.error("[mobile refresh]", e);
    return err("حصلت مشكلة عندنا، جرّب تاني بعد شوية", 500);
  }
}
