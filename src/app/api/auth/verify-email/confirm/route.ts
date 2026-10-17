import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
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
  // A page, not raw JSON: this is a link somebody clicked.
  const limited = await rateLimit("verifyEmail");
  if (!limited.ok) return Response.redirect(`${siteUrl}/verify-email?status=busy`, 302);

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

    // Verifying is idempotent, so the token is kept until it expires.
    // Mail scanners (Outlook Safe Links, corporate gateways) open every
    // link before the person does; burning the token on that first
    // visit left the real click on "invalid link" with the email in
    // fact already verified. A second visit just says "verified" again.
    await db.user.updateMany({
      where: { id: record.userId, emailVerified: null },
      data: { emailVerified: new Date() },
    });

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
    // "Your page is live" only when there is a page: verifying mid-onboarding
    // is common, and the business does not exist yet.
    return to(business ? "success" : "verified");
  } catch (e) {
    log.error("[verify-email/confirm]", e);
    return to("error");
  }
}
