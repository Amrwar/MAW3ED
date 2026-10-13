import { db } from "@/lib/db";
import { claimsForUser, issueTokens, MOBILE_TOKEN_TTL, type TokenPair } from "@/lib/auth/mobile-token";

/**
 * Opening a session for the app, once somebody has proved who they are.
 *
 * Shared by every way of signing in on mobile — email and password for
 * owners, a phone code for customers — so the session row, the token
 * pair and the user object the app stores are built in one place. Two
 * copies would drift, and the app would see a different user shape
 * depending on how somebody signed in.
 */

export interface MobileDevice {
  deviceName?: string;
  platform?: "ios" | "android";
}

export interface MobileLogin extends TokenPair {
  user: {
    id: string;
    name: string | null;
    email: string | null;
    businessId: string | null;
    adminRole: string | null;
  };
}

/** null when the account has gone away between proof and issue. */
export async function startMobileSession(
  userId: string,
  device: MobileDevice,
): Promise<MobileLogin | null> {
  const [claims, user] = await Promise.all([
    claimsForUser(userId),
    db.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true } }),
  ]);
  if (!claims || !user) return null;

  const session = await db.mobileSession.create({
    data: {
      userId,
      deviceName: device.deviceName ?? null,
      platform: device.platform ?? null,
      expiresAt: new Date(Date.now() + MOBILE_TOKEN_TTL.refreshDays * 86_400_000),
    },
    select: { id: true },
  });

  const tokens = await issueTokens(claims, session.id);

  return {
    ...tokens,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      businessId: claims.businessId,
      adminRole: claims.adminRole,
    },
  };
}
