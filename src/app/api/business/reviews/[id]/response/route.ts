import { z } from "zod";
import { db } from "@/lib/db";
import { ok, err, requireBusiness } from "@/lib/api";
import { log } from "@/lib/logger";

type Params = { params: Promise<{ id: string }> };

const schema = z.object({ response: z.string().trim().min(1).max(1000) });

/**
 * PUT /api/business/reviews/[id]/response
 *
 * The owner's public reply, shown under the review.
 *
 * A reply never changes the rating and never hides anything. A business
 * that disagrees with a review answers it in public, which is the only
 * remedy a review platform can honestly offer — if they think it breaks
 * the rules, there is a report button for that, and a moderator decides.
 */
export async function PUT(req: Request, { params }: Params) {
  try {
    const { business } = await requireBusiness();
    const { id } = await params;

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return err("اكتب ردًا", 422);

    // Scoped: a review of somebody else's business is not theirs to
    // answer.
    const review = await db.review.findFirst({
      where: { id, businessId: business.id },
      select: { id: true },
    });
    if (!review) return err("التقييم غير موجود", 404);

    const updated = await db.review.update({
      where: { id },
      data: { response: parsed.data.response, respondedAt: new Date() },
      select: { id: true, response: true, respondedAt: true },
    });

    return ok(updated);
  } catch (e) {
    if (e instanceof Response) return e;
    log.error("[review response PUT]", e);
    return err("حدث خطأ أثناء حفظ الرد", 500);
  }
}

/** DELETE — take the reply down again. The review is untouched. */
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { business } = await requireBusiness();
    const { id } = await params;

    const review = await db.review.findFirst({
      where: { id, businessId: business.id },
      select: { id: true },
    });
    if (!review) return err("التقييم غير موجود", 404);

    await db.review.update({
      where: { id },
      data: { response: null, respondedAt: null },
    });

    return ok({ removed: true });
  } catch (e) {
    if (e instanceof Response) return e;
    log.error("[review response DELETE]", e);
    return err("حدث خطأ", 500);
  }
}
