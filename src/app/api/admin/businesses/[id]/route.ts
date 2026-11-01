import { z } from "zod";
import { db } from "@/lib/db";
import { ok, err } from "@/lib/api";
import { log } from "@/lib/logger";
import { adminNotFound, requireAdminApi } from "@/lib/admin/guard";
import { recordAudit, describeChange } from "@/lib/admin/audit";
import { accessAfterBusinessChange } from "@/lib/access/hooks";
import {
  ACTION_LABELS,
  REQUIRES_REASON,
  STATUS_LABELS,
  STATUS_RESULT,
  canApply,
  publishedAfter,
  type BusinessAction,
} from "@/lib/admin/business-actions";

type Params = { params: Promise<{ id: string }> };

const schema = z.object({
  action: z.enum([
    "approve",
    "reject",
    "suspend",
    "reinstate",
    "verify",
    "unverify",
    "feature",
    "unfeature",
  ]),
  /** Shown to the owner when their page comes down. */
  reason: z.string().trim().max(1000).optional(),
});

/**
 * POST /api/admin/businesses/[id]
 *
 * Moderates one business and records what happened.
 *
 * Three things this does that the screen cannot be trusted to:
 *
 *   - checks the permission server-side, and answers 404 without it,
 *     so a hidden button is not what stops anybody;
 *   - refuses an action that does not apply from the current status,
 *     rather than writing a no-op and a log line about it;
 *   - requires a reason before taking a listing down, because an owner
 *     who finds their page gone is owed a sentence saying why.
 *
 * The write and the audit entry are not in one transaction, and that
 * is deliberate: recordAudit never throws, so a failure there is
 * logged loudly rather than rolling back a suspension somebody meant.
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const actor = await requireAdminApi("businesses.moderate");
    if (!actor) return adminNotFound();

    const { id } = await params;
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return err("إجراء غير معروف", 422);

    const { action, reason } = parsed.data as { action: BusinessAction; reason?: string };

    const business = await db.business.findUnique({
      where: { id },
      select: {
        id: true,
        nameAr: true,
        status: true,
        isVerified: true,
        isFeatured: true,
        isPublished: true,
      },
    });
    if (!business) return err("النشاط غير موجود", 404);

    if (!canApply(action, business.status)) {
      return err(
        `لا يمكن تنفيذ "${ACTION_LABELS[action].ar}" على نشاط حالته "${STATUS_LABELS[business.status].ar}"`,
        409,
      );
    }

    if (REQUIRES_REASON.includes(action) && !reason?.trim()) {
      return err(
        action === "verify"
          ? "اكتب إيه اللي اتراجع (سجل تجاري، عقد، مكالمة على الرقم) — التوثيق معناه إننا اتأكدنا مين صاحب النشاط"
          : "اكتب سبب — صاحب المكان هيشوفه",
        422,
      );
    }

    const nextStatus = STATUS_RESULT[action];
    const now = new Date();

    const data: Record<string, unknown> = {};
    let summary: string;

    if (nextStatus) {
      data.status = nextStatus;
      data.statusNote = reason?.trim() || null;
      data.statusChangedAt = now;
      data.statusChangedById = actor.id;
      data.isPublished = publishedAfter(action, business.isPublished);
      summary = `${actor.name ?? "مشرف"} غيّر حالة "${business.nameAr}" ${describeChange(
        "",
        STATUS_LABELS[business.status].ar,
        STATUS_LABELS[nextStatus].ar,
      )}`;
    } else if (action === "verify" || action === "unverify") {
      // Identity verification, by a person, from evidence — the only
      // thing the public badge stands for (lib/business-verification.ts).
      const verify = action === "verify";
      data.isVerified = verify;
      data.identityVerifiedAt = verify ? now : null;
      data.identityVerifiedById = verify ? actor.id : null;
      data.identityVerificationNote = verify ? reason!.trim() : null;
      summary = `${actor.name ?? "مشرف"} ${action === "verify" ? "وثّق" : "ألغى توثيق"} "${business.nameAr}"`;
    } else {
      data.isFeatured = action === "feature";
      data.featuredAt = action === "feature" ? now : null;
      summary = `${actor.name ?? "مشرف"} ${action === "feature" ? "ميّز" : "ألغى تمييز"} "${business.nameAr}"`;
    }

    const updated = await db.business.update({
      where: { id },
      data,
      select: {
        id: true,
        status: true,
        isVerified: true,
        isFeatured: true,
        isPublished: true,
        statusNote: true,
      },
    });

    await recordAudit({
      actor,
      action: ACTION_LABELS[action].verb,
      resourceType: "business",
      resourceId: id,
      summary,
      metadata: {
        businessName: business.nameAr,
        from: {
          status: business.status,
          isVerified: business.isVerified,
          isFeatured: business.isFeatured,
          isPublished: business.isPublished,
        },
        to: {
          status: updated.status,
          isVerified: updated.isVerified,
          isFeatured: updated.isFeatured,
          isPublished: updated.isPublished,
        },
        ...(reason?.trim() ? { reason: reason.trim() } : {}),
      },
    });

    // Visitor passes depend on the business being open (Phase 23).
    if (updated.status !== business.status) {
      await accessAfterBusinessChange(id).catch((e) => log.error("[admin business action] access resync", e, { businessId: id }));
    }

    return ok(updated);
  } catch (e) {
    log.error("[admin business action]", e);
    return err("حصلت مشكلة عندنا، جرّب تاني بعد شوية", 500);
  }
}
