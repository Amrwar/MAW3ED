import { z } from "zod";
import { db } from "@/lib/db";
import { ok, err } from "@/lib/api";
import { log } from "@/lib/logger";
import { adminNotFound, requireAdminApi } from "@/lib/admin/guard";
import { recordAudit } from "@/lib/admin/audit";
import { recomputeBusinessRating } from "@/lib/reviews";
import { ACTION_RESULT, canModerate } from "@/lib/review-policy";

type Params = { params: Promise<{ id: string }> };

const schema = z.object({
  action: z.enum(["approve", "hide", "investigate", "restore", "flag"]),
  /** For the next moderator to read. Never shown publicly. */
  note: z.string().max(1000).optional(),
});

/**
 * POST /api/admin/reviews/[id]
 *
 * A moderator acts on a review.
 *
 * Whatever happens to the review, the business's rating is recomputed
 * afterwards — hiding a one-star review has to take it out of the
 * average, or the number on the profile would describe a set of reviews
 * that is no longer the set being shown. That is the single failure
 * this whole system exists to prevent.
 *
 * Open reports against the review are resolved in the same transaction:
 * approving upholds nothing, hiding upholds them all. A report left
 * open after its review was judged would sit in the queue forever.
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const admin = await requireAdminApi("reviews.moderate");
    if (!admin) return adminNotFound();

    const { id } = await params;
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return err("إجراء غير معروف", 422);

    const review = await db.review.findUnique({
      where: { id },
      select: { id: true, status: true, businessId: true },
    });
    if (!review) return err("التقييم غير موجود", 404);

    const { action, note } = parsed.data;

    if (!canModerate(review.status, action)) {
      return err(`لا يمكن تنفيذ "${action}" على تقييم حالته ${review.status}`, 409);
    }

    const next = ACTION_RESULT[action];
    const upheld = action === "hide";

    await db.$transaction([
      db.review.update({
        where: { id },
        data: {
          status: next,
          moderationNote: note?.trim() || null,
          moderatedAt: new Date(),
          moderatedById: admin.id,
        },
      }),
      // "investigate" and "flag" open the question rather than closing
      // it, so they leave the reports alone.
      ...(action === "approve" || action === "hide" || action === "restore"
        ? [
            db.reviewReport.updateMany({
              where: { reviewId: id, status: "OPEN" },
              data: {
                status: upheld ? "UPHELD" : "DISMISSED",
                resolvedAt: new Date(),
                resolvedById: admin.id,
              },
            }),
          ]
        : []),
    ]);

    // Outside the transaction: it reads the reviews back, so it has to
    // see the write that just happened.
    await recomputeBusinessRating(review.businessId);

    await recordAudit({
      actor: admin,
      action: `review.${action}`,
      resourceType: "review",
      resourceId: id,
      summary: `${admin.name ?? "مراجع"} نفّذ "${action}" على تقييم وحوله من ${review.status} إلى ${next}`,
      metadata: {
        from: review.status,
        to: next,
        businessId: review.businessId,
        ...(note?.trim() ? { note: note.trim() } : {}),
      },
    });

    const summary = await db.business.findUnique({
      where: { id: review.businessId },
      select: { ratingAvg: true, ratingCount: true },
    });

    return ok({
      id,
      status: next,
      ratingAvg: summary?.ratingAvg ?? null,
      ratingCount: summary?.ratingCount ?? 0,
    });
  } catch (e) {
    log.error("[admin review action]", e);
    return err("حدث خطأ", 500);
  }
}
