import { z } from "zod";
import { db } from "@/lib/db";
import { ok, err, requireBusiness } from "@/lib/api";
import { businessHandle, readJson } from "@/lib/business/route";

/**
 * The Phase 27 operating rules a business sets for itself: the no-show
 * policy, the slot waitlist, companions, and which automatic messages
 * go out. Bounds mirror Business_phase27_chk.
 */
const SELECT = {
  noShowLimit: true, noShowWindowDays: true, noShowAction: true,
  waitlistEnabled: true, waitlistOfferMinutes: true, maxCompanions: true,
  followUpEnabled: true, followUpDelayHours: true, rebookReminderEnabled: true, rebookAfterDays: true,
  membershipRenewalNoticeDays: true, loyaltyNoticesEnabled: true,
} as const;

const body = z.object({
  noShowLimit: z.number().int().min(1).max(20).nullable(),
  noShowWindowDays: z.number().int().min(30).max(730),
  noShowAction: z.enum(["REQUIRE_DEPOSIT", "BLOCK_ONLINE"]),
  waitlistEnabled: z.boolean(),
  waitlistOfferMinutes: z.number().int().min(10).max(240),
  maxCompanions: z.number().int().min(0).max(5),
  followUpEnabled: z.boolean(),
  followUpDelayHours: z.number().int().min(1).max(168),
  rebookReminderEnabled: z.boolean(),
  rebookAfterDays: z.number().int().min(7).max(365),
  membershipRenewalNoticeDays: z.number().int().min(1).max(14),
  loyaltyNoticesEnabled: z.boolean(),
}).partial();

export async function GET() {
  return businessHandle("operations GET", async () => {
    const { business } = await requireBusiness();
    const row = await db.business.findUnique({ where: { id: business.id }, select: SELECT });
    return ok({ settings: row });
  });
}

export async function PATCH(req: Request) {
  return businessHandle("operations PATCH", async () => {
    const { business } = await requireBusiness();
    const parsed = body.safeParse(await readJson(req));
    if (!parsed.success) return err(parsed.error.issues[0].message, 422, { code: "invalid" });
    const row = await db.business.update({ where: { id: business.id }, data: parsed.data, select: SELECT });
    return ok({ settings: row });
  });
}
