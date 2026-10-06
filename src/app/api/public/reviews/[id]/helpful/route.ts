import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { ok, err } from "@/lib/api";
import { log } from "@/lib/logger";
import {
  DEVICE_COOKIE,
  isDeviceId,
  newDeviceId,
  voterHash,
} from "@/lib/review-identity";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/public/reviews/[id]/helpful
 *
 * Marks a review as useful, or takes the mark back.
 *
 * Open to anybody, because most people reading reviews are not signed
 * in and a count that only signed-in customers could move would order
 * nothing. One vote per device per review, enforced by a unique index
 * rather than by this code, so two taps in the same instant cannot both
 * land.
 *
 * helpfulCount on the review is the denormalised figure the sort reads;
 * ReviewVote is the truth. Both are written in one transaction so they
 * cannot disagree.
 */
export async function POST(_req: Request, { params }: Params) {
  try {
    const { id } = await params;

    const jar = await cookies();
    const existing = jar.get(DEVICE_COOKIE)?.value;
    const deviceId = isDeviceId(existing) ? existing : newDeviceId();

    // Only a review somebody can actually see may be voted on.
    const review = await db.review.findFirst({
      where: { id, status: { in: ["PUBLISHED", "UNDER_REVIEW"] } },
      select: { id: true },
    });
    if (!review) return err("التقييم غير موجود", 404);

    const hash = voterHash(deviceId, id);

    const already = await db.reviewVote.findUnique({
      where: { reviewId_voterHash: { reviewId: id, voterHash: hash } },
      select: { id: true },
    });

    let helpfulCount: number;

    if (already) {
      // Tapping again takes the vote back, which is what a pressed
      // button that cannot be unpressed would otherwise trap somebody in.
      const [, updated] = await db.$transaction([
        db.reviewVote.delete({ where: { id: already.id } }),
        db.review.update({
          where: { id },
          data: { helpfulCount: { decrement: 1 } },
          select: { helpfulCount: true },
        }),
      ]);
      helpfulCount = updated.helpfulCount;
    } else {
      try {
        const [, updated] = await db.$transaction([
          db.reviewVote.create({ data: { reviewId: id, voterHash: hash } }),
          db.review.update({
            where: { id },
            data: { helpfulCount: { increment: 1 } },
            select: { helpfulCount: true },
          }),
        ]);
        helpfulCount = updated.helpfulCount;
      } catch {
        // Lost the race against the unique index: somebody's double-tap
        // arrived twice. The first one counted, which is correct.
        const current = await db.review.findUnique({
          where: { id },
          select: { helpfulCount: true },
        });
        return ok({ voted: true, helpfulCount: current?.helpfulCount ?? 0 });
      }
    }

    const res = ok({ voted: !already, helpfulCount });

    if (!isDeviceId(existing)) {
      res.headers.append(
        "Set-Cookie",
        `${DEVICE_COOKIE}=${deviceId}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax; HttpOnly`,
      );
    }

    return res;
  } catch (e) {
    log.error("[review helpful]", e);
    return err("حدث خطأ", 500);
  }
}

// A helpful vote deliberately does not touch the rating. Voting on a
// review is not reviewing the business.
