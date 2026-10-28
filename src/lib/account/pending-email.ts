import { db } from "@/lib/db";

/**
 * The address an account has asked to move to and not yet confirmed,
 * or null.
 *
 * A change is a verification token that carries the new address
 * (PATCH /api/account/profile). It stays until it expires even after
 * being followed, so a mail scanner's early visit does not burn the
 * link — which means "pending" has to exclude a token whose address is
 * already the account's.
 */
export async function pendingEmailFor(userId: string, currentEmail: string | null): Promise<string | null> {
  const token = await db.emailVerificationToken.findFirst({
    where: {
      userId,
      email: { not: null },
      expiresAt: { gt: new Date() },
      ...(currentEmail ? { NOT: { email: { equals: currentEmail, mode: "insensitive" } } } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: { email: true },
  });
  return token?.email ?? null;
}
