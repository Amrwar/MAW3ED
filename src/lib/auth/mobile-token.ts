import { SignJWT, jwtVerify } from "jose";
import { db } from "@/lib/db";
import { signingSecret } from "./signing-secret";

/**
 * Tokens for native clients.
 *
 * The web signs in with a NextAuth cookie, and a cookie is the wrong
 * instrument for a native app: it is host-scoped, httpOnly, SameSite,
 * and it belongs to a browser's jar rather than to the app. Rather than
 * fight that, a native client gets a pair of bearer tokens and the API
 * learns to accept them alongside the cookie — one more way in to the
 * same session, not a second authentication system.
 *
 * Two tokens, for the usual reason:
 *
 *   access   short-lived, sent on every request. If it leaks it is
 *            worth little for long.
 *   refresh  long-lived, sent only to /api/auth/mobile/refresh, and
 *            recorded in the database so it can be revoked. A bearer
 *            token that cannot be revoked is a password that never
 *            expires.
 *
 * Both are signed with AUTH_SECRET, which NextAuth already requires, so
 * there is no new secret to manage or to leak.
 */

const ACCESS_TTL_SECONDS = 60 * 15; // 15 minutes
const REFRESH_TTL_DAYS = 60;

const ISSUER = "maw3ed";
const ACCESS_AUDIENCE = "maw3ed-mobile-access";
const REFRESH_AUDIENCE = "maw3ed-mobile-refresh";

function secret(): Uint8Array {
  return signingSecret("mobile tokens");
}

export interface MobileTokenClaims {
  /** User id. */
  sub: string;
  /** The business this account owns, when it owns one. */
  businessId: string | null;
  /** Admin role, read from the database at issue time, never trusted from the client. */
  adminRole: string | null;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  /** Seconds until the access token expires, for the client's timer. */
  expiresIn: number;
}

/**
 * Issue a fresh pair.
 *
 * `sessionId` ties the refresh token to a row that can be deleted. The
 * token carries it so a refresh can check the row still exists.
 *
 * `generation` is the session's refreshGeneration this token is good
 * for. Rotation (lib/auth/mobile-refresh.ts) compares it with the row,
 * which is what makes a refresh token usable once.
 */
export async function issueTokens(
  claims: MobileTokenClaims,
  sessionId: string,
  generation = 0,
): Promise<TokenPair> {
  const key = secret();
  const now = Math.floor(Date.now() / 1000);

  const accessToken = await new SignJWT({
    businessId: claims.businessId,
    adminRole: claims.adminRole,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuer(ISSUER)
    .setAudience(ACCESS_AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(now + ACCESS_TTL_SECONDS)
    .sign(key);

  const refreshToken = await new SignJWT({ sid: sessionId, gen: generation })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuer(ISSUER)
    .setAudience(REFRESH_AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(now + REFRESH_TTL_DAYS * 24 * 60 * 60)
    .sign(key);

  return { accessToken, refreshToken, expiresIn: ACCESS_TTL_SECONDS };
}

/**
 * Read an access token.
 *
 * Returns null on anything wrong — bad signature, wrong audience,
 * expired, malformed. The caller treats null as "not signed in" and
 * never as an error worth describing to the client.
 */
export async function readAccessToken(token: string): Promise<MobileTokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), {
      issuer: ISSUER,
      audience: ACCESS_AUDIENCE,
    });
    if (!payload.sub) return null;
    return {
      sub: payload.sub,
      businessId: (payload.businessId as string | null) ?? null,
      adminRole: (payload.adminRole as string | null) ?? null,
    };
  } catch {
    return null;
  }
}

export interface RefreshTokenRead {
  userId: string;
  sessionId: string;
  /**
   * The generation the token was issued at. Tokens from before rotation
   * existed carry none and read as 0 — the default every existing row
   * was given — so they are honoured once and rotated from then on.
   */
  generation: number;
}

/** Read a refresh token and the session row it points at. */
export async function readRefreshToken(token: string): Promise<RefreshTokenRead | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), {
      issuer: ISSUER,
      audience: REFRESH_AUDIENCE,
    });
    const sid = payload.sid as string | undefined;
    if (!payload.sub || !sid) return null;
    const gen = payload.gen === undefined ? 0 : payload.gen;
    if (typeof gen !== "number" || !Number.isInteger(gen) || gen < 0) return null;
    return { userId: payload.sub, sessionId: sid, generation: gen };
  } catch {
    return null;
  }
}

/**
 * The claims to put in a token, read fresh from the database.
 *
 * Role and business ownership are read here rather than copied from
 * whatever the client last held, for the same reason the admin guard
 * re-reads a role instead of trusting the one in the session: a token
 * lives for weeks and the facts in it can stop being true.
 */
export async function claimsForUser(userId: string): Promise<MobileTokenClaims | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      adminRole: true,
      business: { select: { id: true } },
    },
  });
  if (!user) return null;

  return {
    sub: user.id,
    businessId: user.business?.id ?? null,
    adminRole: user.adminRole ?? null,
  };
}

export const MOBILE_TOKEN_TTL = {
  accessSeconds: ACCESS_TTL_SECONDS,
  refreshDays: REFRESH_TTL_DAYS,
};
