import { db } from "@/lib/db";
import { log } from "@/lib/logger";
import {
  claimsForUser,
  issueTokens,
  type RefreshTokenRead,
  type TokenPair,
} from "@/lib/auth/mobile-token";

/**
 * Trading a refresh token for a new pair, with rotation.
 *
 * Without rotation a refresh token was a sixty-day bearer credential:
 * copied once — a backup, a log, a compromised phone — it kept working
 * alongside the real app until the session expired, and nothing could
 * tell the two apart. Now each refresh token is good for one refresh.
 * The session row holds the live generation; a refresh advances it and
 * hands back a token for the next one.
 *
 * An older generation turning up again means somebody else holds a
 * copy. We cannot tell which party is the legitimate one, so the
 * session is revoked and both have to sign in again — the real owner
 * can, the thief cannot.
 *
 * One allowance: the generation immediately before the live one is
 * honoured for a short grace after it was rotated. The app refreshes
 * single-flight (mobile/lib/api/client.ts), but a response can still be
 * lost on a flaky connection after the server has rotated, and the app
 * then retries with the token it still has. Signing somebody out for
 * walking into a lift would be the security feature that gets turned off.
 */

/** How long the previous refresh token stays honoured after a rotation. */
export const REFRESH_GRACE_MS = 30_000;

export type RefreshResult =
  | { ok: true; tokens: TokenPair }
  | { ok: false; reason: "no-session" | "reused" };

export async function rotateRefresh(read: RefreshTokenRead, now = new Date()): Promise<RefreshResult> {
  let session: Awaited<ReturnType<typeof loadSession>>;
  try {
    session = await loadSession(read, now);
  } catch (error) {
    // P2022: the columns are not there — this code is live before
    // add_mobile_refresh_rotation.sql ran. Refresh the old way rather
    // than failing every refresh, which would sign out every app user
    // within one access-token lifetime.
    if ((error as { code?: string })?.code !== "P2022") throw error;
    log.error("[mobile refresh] rotation columns missing; run add_mobile_refresh_rotation.sql");
    return refreshWithoutRotation(read, now);
  }
  if (!session) return { ok: false, reason: "no-session" };

  const claims = await claimsForUser(session.userId);
  if (!claims) return { ok: false, reason: "no-session" };

  if (read.generation === session.refreshGeneration) {
    // Conditional on the generation we just read, so two requests
    // carrying the same token cannot both advance it: the database lets
    // exactly one of them through.
    const advanced = await db.mobileSession.updateMany({
      where: { id: session.id, refreshGeneration: read.generation },
      data: {
        refreshGeneration: { increment: 1 },
        rotatedAt: now,
        lastUsedAt: now,
      },
    });
    if (advanced.count === 1) {
      return { ok: true, tokens: await issueTokens(claims, session.id, read.generation + 1) };
    }
    // Lost that race. The winner has just rotated, so this token is now
    // the previous generation and the grace check below decides.
  }

  const current = await loadSession(read, now);
  if (!current) return { ok: false, reason: "no-session" };

  const isPrevious = read.generation === current.refreshGeneration - 1;
  const withinGrace =
    current.rotatedAt !== null && now.getTime() - current.rotatedAt.getTime() <= REFRESH_GRACE_MS;

  if (isPrevious && withinGrace) {
    // Re-issued at the live generation without advancing it: whichever
    // response the app ends up keeping, its next refresh is valid.
    await db.mobileSession.updateMany({ where: { id: current.id }, data: { lastUsedAt: now } });
    return { ok: true, tokens: await issueTokens(claims, current.id, current.refreshGeneration) };
  }

  // Older than that, or the grace has passed: a token that was already
  // spent is being spent again. End the session for everybody holding it.
  await db.mobileSession.deleteMany({ where: { id: current.id } });
  log.warn("[mobile refresh] refresh token reused; session revoked", {
    userId: current.userId,
    sessionId: current.id,
  });
  return { ok: false, reason: "reused" };
}

/** The pre-rotation refresh, for a database the migration has not reached. */
async function refreshWithoutRotation(read: RefreshTokenRead, now: Date): Promise<RefreshResult> {
  const session = await db.mobileSession.findUnique({
    where: { id: read.sessionId },
    select: { id: true, userId: true, expiresAt: true },
  });
  if (!session || session.userId !== read.userId || session.expiresAt < now) return { ok: false, reason: "no-session" };
  const claims = await claimsForUser(session.userId);
  if (!claims) return { ok: false, reason: "no-session" };
  await db.mobileSession.updateMany({ where: { id: session.id }, data: { lastUsedAt: now } });
  return { ok: true, tokens: await issueTokens(claims, session.id, 0) };
}

/** The row the token names, only while it is live and belongs to the token's user. */
async function loadSession(read: RefreshTokenRead, now: Date) {
  const session = await db.mobileSession.findUnique({
    where: { id: read.sessionId },
    select: { id: true, userId: true, expiresAt: true, refreshGeneration: true, rotatedAt: true },
  });
  // Revoked, or belongs to somebody else, or simply old.
  if (!session || session.userId !== read.userId || session.expiresAt < now) return null;
  return session;
}
