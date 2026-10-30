import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireBusinessPage } from "@/lib/dashboard/guard";
import { loadReadiness } from "@/lib/business/readiness-load";
import { getVerificationStates } from "@/lib/business-verification";
import SetupClient from "./_components/SetupClient";

export const metadata: Metadata = { title: "تجهيز النشاط" };

/**
 * The setup checklist: what is missing before the page can go live,
 * the booking policies, a test booking, and the publish switch.
 *
 * Everything here is read from the server's own checklist
 * (lib/business/readiness.ts) — the same one the publish endpoint
 * enforces — so the page can never say "ready" about a business the
 * server would refuse to publish.
 */
export default async function SetupPage() {
  const { session, business } = await requireBusinessPage();

  const [readiness, verification, row, owner, testBookings] = await Promise.all([
    loadReadiness(business.id),
    getVerificationStates(business.id),
    db.business.findUniqueOrThrow({
      where: { id: business.id },
      select: {
        slug: true,
        isPublished: true,
        publishRequestedAt: true,
        status: true,
        autoConfirm: true,
        minNoticeMinutes: true,
        maxAdvanceDays: true,
        bufferMinutes: true,
        sameDayCutoff: true,
        cancellationCutoffHours: true,
        policiesReviewedAt: true,
      },
    }),
    db.user.findUnique({ where: { id: session.user.id }, select: { email: true, emailVerified: true } }),
    db.booking.count({ where: { businessId: business.id, isTest: true } }),
  ]);

  if (!readiness || !verification) return null;

  return (
    <SetupClient
      slug={row.slug}
      readiness={readiness}
      verification={verification}
      isPublished={row.isPublished}
      publishRequested={row.publishRequestedAt !== null}
      status={row.status}
      email={owner?.email ?? null}
      testBookings={testBookings}
      policies={{
        autoConfirm: row.autoConfirm,
        minNoticeMinutes: row.minNoticeMinutes,
        maxAdvanceDays: row.maxAdvanceDays,
        bufferMinutes: row.bufferMinutes,
        sameDayCutoff: row.sameDayCutoff,
        cancellationCutoffHours: row.cancellationCutoffHours,
        reviewed: row.policiesReviewedAt !== null,
      }}
    />
  );
}
