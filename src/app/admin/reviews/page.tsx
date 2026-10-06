import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/admin/guard";
import ModerationQueue from "./_components/ModerationQueue";
import { adminMetadata } from "@/lib/admin/meta";

export const generateMetadata = adminMetadata("reviews.read", "مراجعة التقييمات");

/**
 * The title is decided per request, not exported as a constant.
 *
 * A static title is rendered before the page body runs, so a visitor
 * who is not an admin got a 404 page in a tab headed "review
 * moderation" — which told them the page exists, the one thing the
 * notFound() is there to avoid.
 */

/**
 * The moderation queue.
 *
 * Reported and flagged reviews first, because they are the ones waiting
 * on a person. A moderator sees the review, the business it is about,
 * who complained and why — and the booking behind it, which is usually
 * what settles whether a review is real.
 */
export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminPage("reviews.read");

  const sp = await searchParams;
  const one = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const view = one("view") ?? "queue";

  const where: Prisma.ReviewWhereInput =
    view === "hidden"
      ? { status: "HIDDEN" }
      : view === "all"
        ? {}
        : { status: "UNDER_REVIEW" };

  const [reviews, counts] = await Promise.all([
    db.review.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      take: 100,
      select: {
        id: true,
        rating: true,
        comment: true,
        photos: true,
        status: true,
        helpfulCount: true,
        editedAt: true,
        createdAt: true,
        moderationNote: true,
        moderatedAt: true,
        business: { select: { nameAr: true, slug: true } },
        booking: {
          select: {
            reference: true,
            status: true,
            date: true,
            customerName: true,
            service: { select: { nameAr: true } },
          },
        },
        reports: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            reason: true,
            detail: true,
            status: true,
            byBusiness: true,
            createdAt: true,
          },
        },
      },
    }),
    db.review.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const tally: Record<string, number> = {};
  for (const c of counts) tally[c.status] = c._count._all;

  return (
    <ModerationQueue
      view={view}
      tally={tally}
      reviews={reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        photos: r.photos,
        status: r.status,
        helpfulCount: r.helpfulCount,
        edited: r.editedAt !== null,
        createdAt: r.createdAt.toISOString(),
        moderationNote: r.moderationNote,
        moderatedAt: r.moderatedAt ? r.moderatedAt.toISOString() : null,
        businessName: r.business.nameAr,
        businessSlug: r.business.slug,
        booking: {
          reference: r.booking.reference,
          status: r.booking.status,
          date: r.booking.date.toISOString().slice(0, 10),
          customerName: r.booking.customerName,
          serviceName: r.booking.service?.nameAr ?? null,
        },
        reports: r.reports.map((rep) => ({
          id: rep.id,
          reason: rep.reason,
          detail: rep.detail,
          status: rep.status,
          byBusiness: rep.byBusiness,
          createdAt: rep.createdAt.toISOString(),
        })),
      }))}
    />
  );
}
