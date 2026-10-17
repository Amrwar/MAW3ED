import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { ok, err } from "@/lib/api";
import { log } from "@/lib/logger";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
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

    // Per address, before anything else. The device cookie below is
    // free to mint — clear it and you are a new voter — so the only
    // thing that makes stuffing a count expensive is this ceiling.
    const limited = await rateLimit("reviewHelpful");
    if (!limited.ok) return tooManyRequests(limited);

    const jar = await cookies();
    const existing = jar.get(DEVICE_COOKIE)?.value;

    // No device id, no vote. Minting one here and counting the vote in
    // the same request made every cookieless request a fresh voter, so
    // a script that never kept cookies could press the button forever.
    // Instead the id is issued with the refusal and the browser — which
    // keeps cookies — retries once with it (ReviewActions does). A
    // script has to keep the cookie to vote, and keeping it means its
    // second press takes the vote back rather than adding another.
    if (!isDeviceId(existing)) {
      const res = err("أعد المحاولة", 428, { code: "device-required" });
      res.headers.append("Set-Cookie", deviceCookie(newDeviceId()));
      return res;
    }
    const deviceId = existing;

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

    return ok({ voted: !already, helpfulCount });
  } catch (e) {
    log.error("[review helpful]", e);
    return err("حصلت مشكلة عندنا، جرّب تاني بعد شوية", 500);
  }
}

function deviceCookie(deviceId: string): string {
  return `${DEVICE_COOKIE}=${deviceId}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax; HttpOnly`;
}

// A helpful vote deliberately does not touch the rating. Voting on a
// review is not reviewing the business.
