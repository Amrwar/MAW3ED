import { z } from "zod";
import { db } from "@/lib/db";
import { ok, err, requireSession } from "@/lib/api";
import { readRefreshToken } from "@/lib/auth/mobile-token";
import { log } from "@/lib/logger";
import { recordAccountEvent } from "@/lib/account/audit-event";

/**
 * The devices signed in to this account through the app.
 *
 * GET lists them. POST ends them: one by id, or every one except the
 * device asking — identified by its refresh token, which only that
 * device holds. Every query is scoped to the caller, so a session id
 * belonging to anybody else matches nothing.
 *
 * Ending a session deletes its row, so its refresh token stops working
 * at once; an access token already issued lives out its short life.
 */
export async function GET(req: Request) {
  try {
    const session = await requireSession();
    const current = await currentSessionId(req.headers.get("x-refresh-token"), session.user.id);

    const rows = await db.mobileSession.findMany({
      where: { userId: session.user.id, expiresAt: { gt: new Date() } },
      orderBy: { lastUsedAt: "desc" },
      select: { id: true, deviceName: true, createdAt: true, lastUsedAt: true },
    });

    return ok({
      sessions: rows.map((s) => ({
        id: s.id,
        deviceName: s.deviceName,
        createdAt: s.createdAt.toISOString(),
        lastUsedAt: s.lastUsedAt.toISOString(),
        current: s.id === current,
      })),
    });
  } catch (e) {
    if (e instanceof Response) return e;
    log.error("[account sessions GET]", e);
    return err("حصلت مشكلة عندنا، جرّب تاني بعد شوية", 500);
  }
}

const schema = z.union([
  z.object({ sessionId: z.string().min(1) }),
  z.object({ allExcept: z.string().min(10) }),
  /**
   * Sign out everywhere: every app session is deleted and every web
   * session signed in before now is refused on its next check
   * (lib/security/session-policy.ts) — the one asking included, which
   * is what "everywhere" means after a lost phone or a shared computer.
   */
  z.object({ everywhere: z.literal(true) }),
]);

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return err("طلب غير صالح", 422);

    if ("everywhere" in parsed.data) {
      const now = new Date();
      const [, mobile] = await db.$transaction([
        db.user.update({ where: { id: session.user.id }, data: { sessionsRevokedAt: now } }),
        db.mobileSession.deleteMany({ where: { userId: session.user.id } }),
      ]);
      await recordAccountEvent({ userId: session.user.id, action: "account.sessions_revoked", summary: "Signed out of every device and browser." });

      // Other browsers are refused on their next check (within five
      // minutes). The browser asking is signed out now: its cookie is
      // cleared with the answer, under both names NextAuth uses, so a
      // shared computer is not left signed in for the next person.
      const res = ok({ ended: mobile.count, webRevokedAt: now.toISOString() });
      if (req.headers.get("cookie")?.includes("authjs.session-token")) {
        res.headers.append("Set-Cookie", "authjs.session-token=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax");
        res.headers.append("Set-Cookie", "__Secure-authjs.session-token=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax");
      }
      return res;
    }

    if ("sessionId" in parsed.data) {
      const { count } = await db.mobileSession.deleteMany({
        where: { id: parsed.data.sessionId, userId: session.user.id },
      });
      return ok({ ended: count });
    }

    // Without a recognisable current session, end none rather than all:
    // signing the asker out of the device they are holding is not what
    // "other devices" means.
    const keep = await currentSessionId(parsed.data.allExcept, session.user.id);
    if (!keep) return err("مش قادرين نحدد الجهاز ده. سجّل خروج وادخل تاني.", 409, { code: "unknown-session" });
    const { count } = await db.mobileSession.deleteMany({
      where: { userId: session.user.id, id: { not: keep } },
    });
    return ok({ ended: count });
  } catch (e) {
    if (e instanceof Response) return e;
    log.error("[account sessions POST]", e);
    return err("حصلت مشكلة عندنا، جرّب تاني بعد شوية", 500);
  }
}

/** The session a refresh token names — only if it is this user's. */
async function currentSessionId(refreshToken: string | null, userId: string): Promise<string | null> {
  if (!refreshToken) return null;
  const read = await readRefreshToken(refreshToken);
  return read && read.userId === userId ? read.sessionId : null;
}
