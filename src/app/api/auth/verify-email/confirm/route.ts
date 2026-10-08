import { db } from "@/lib/db";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { log } from "@/lib/logger";
import { siteUrl } from "@/lib/env";
import { hashSecret, isExpired } from "@/lib/verification";
import { syncVerifiedBadge } from "@/lib/business-verification";

/**
 * GET /api/auth/verify-email/confirm?token=...
 *
 * Followed from the email, so it redirects to a page rather than
 * returning JSON. The token is looked up by hash — the plaintext is
 * never stored — and is single-use.
 */
export async function GET(req: Request) {
  // An emailed link is still a token to guess at. Limited by
  // caller, since no account is named until the token resolves.
  const limited = await rateLimit("verifyEmail");
  if (!limited.ok) return tooManyRequests(limited);

  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  const to = (status: string) =>
    Response.redirect(`${siteUrl}/verify-email?status=${status}`, 302);

  if (!token) return to("invalid");

  try {
    const record = await db.emailVerificationToken.findUnique({
      where: { tokenHash: hashSecret(token) },
      select: { id: true, userId: true, expiresAt: true },
    });

    if (!record) return to("invalid");

    if (isExpired(record.expiresAt)) {
      await db.emailVerificationToken.delete({ where: { id: record.id } });
      return to("expired");
    }

    await db.$transaction([
      db.user.update({
        where: { id: record.userId },
        data: { emailVerified: new Date() },
      }),
      // Single use: burn it, and any sibling tokens for this account.
      db.emailVerificationToken.deleteMany({ where: { userId: record.userId } }),
    ]);

    // A business held back at signup can now go live.
    const business = await db.business.findUnique({
      where: { ownerId: record.userId },
      select: { id: true },
    });
    if (business) {
      await db.business.update({
        where: { id: business.id },
        data: { isPublished: true },
      });
      await syncVerifiedBadge(business.id);
    }

    log.info("email verified", { userId: record.userId });
    return to("success");
  } catch (e) {
    log.error("[verify-email/confirm]", e);
    return to("error");
  }
}
