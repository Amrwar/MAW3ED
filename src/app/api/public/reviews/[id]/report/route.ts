import { z } from "zod";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { ok, err } from "@/lib/api";
import { log } from "@/lib/logger";
import {
  DEVICE_COOKIE,
  isDeviceId,
  newDeviceId,
  reporterScopeHash,
  voterHash,
} from "@/lib/review-identity";

type Params = { params: Promise<{ id: string }> };

const schema = z.object({
  reason: z.enum(["INAPPROPRIATE", "FAKE", "SPAM", "HARASSMENT", "OTHER"]),
  detail: z.string().max(1000).optional(),
});

/** How many reviews one device may report in a day. */
const MAX_REPORTS_PER_DAY = 10;

/**
 * POST /api/public/reviews/[id]/report
 *
 * Tells a moderator that something is wrong with a review.
 *
 * Reporting does not hide anything. A review stays visible and simply
 * becomes UNDER_REVIEW, because a report that hid a review on the spot
 * would be a censorship button: anybody could silence any review by
 * tapping it, and a business could silence its worst one.
 *
 * The response is the same whether or not the report was new, so
 * reporting cannot be used to find out what has already been reported.
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const { id } = await params;

    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) return err("اختر سبب الإبلاغ", 422);

    const review = await db.review.findFirst({
      where: { id, status: { in: ["PUBLISHED", "UNDER_REVIEW"] } },
      select: { id: true, status: true, businessId: true },
    });
    // The same answer as a successful report: whether a review exists
    // and is visible is not something a report should reveal.
    if (!review) return ok({ reported: true });

    const jar = await cookies();
    const existingDevice = jar.get(DEVICE_COOKIE)?.value;
    const deviceId = isDeviceId(existingDevice) ? existingDevice : newDeviceId();

    // Somebody reporting everything they see is the signal a moderator
    // needs, so the ceiling is per device per day.
    const since = new Date(Date.now() - 86_400_000);
    const scope = reporterScopeHash(deviceId);
    const recent = await db.reviewReport.count({
      where: { reporterHash: { startsWith: scope.slice(0, 16) }, createdAt: { gte: since } },
    });
    if (recent >= MAX_REPORTS_PER_DAY) {
      return err("وصلت للحد الأقصى من البلاغات النهارده", 429);
    }

    // Is the business being reviewed the one complaining? A moderator
    // should know who is asking.
    const session = await auth();
    const byBusiness = Boolean(
      session?.user?.businessId && session.user.businessId === review.businessId,
    );

    // The first 16 characters are the per-device scope, so the count
    // above can find them; the rest is per review, so the rows cannot be
    // joined into a reading history.
    const reporterHash = `${scope.slice(0, 16)}${voterHash(deviceId, id).slice(0, 48)}`;

    try {
      await db.$transaction([
        db.reviewReport.create({
          data: {
            reviewId: id,
            reason: parsed.data.reason,
            detail: parsed.data.detail?.trim() || null,
            reporterHash,
            byBusiness,
          },
        }),
        // Visible, but now in the queue. Already-hidden reviews are left
        // where a moderator put them.
        ...(review.status === "PUBLISHED"
          ? [db.review.update({ where: { id }, data: { status: "UNDER_REVIEW" } })]
          : []),
      ]);
    } catch {
      // The unique index refused a second identical report. Nothing to
      // do, and nothing to tell the reporter.
    }

    const res = ok({ reported: true });
    if (!isDeviceId(existingDevice)) {
      res.headers.append(
        "Set-Cookie",
        `${DEVICE_COOKIE}=${deviceId}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax; HttpOnly`,
      );
    }
    return res;
  } catch (e) {
    log.error("[review report]", e);
    return err("حصلت مشكلة عندنا، جرّب تاني بعد شوية", 500);
  }
}
