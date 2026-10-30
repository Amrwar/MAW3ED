import { z } from "zod";
import { db } from "@/lib/db";
import { ok, err } from "@/lib/api";
import { adminNotFound, requireAdminApi } from "@/lib/admin/guard";
import { recordAudit } from "@/lib/admin/audit";
import { orgHandle, readJson } from "@/lib/organizations/route";

const schema = z.object({
  status: z.enum(["APPROVED", "REJECTED", "SUSPENDED"]),
  /** Shown to the organization; required for a rejection or suspension. */
  reason: z.string().trim().max(1000).optional(),
});

/**
 * PATCH /api/admin/organizations/:id — the platform's review: approve a
 * registration, reject it, or suspend a live organization. Suspension
 * and rejection take the page down; the organization's businesses keep
 * working untouched — only the directory page and recruiting stop.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return orgHandle("admin organization PATCH", async () => {
    const actor = await requireAdminApi("venues.manage");
    if (!actor) return adminNotFound();
    const { id } = await params;
    const parsed = schema.safeParse(await readJson(req));
    if (!parsed.success) return err("بيانات غير صالحة", 422);
    const { status, reason } = parsed.data;
    if (status !== "APPROVED" && !reason?.trim()) return err("اكتب السبب — بيظهر للجهة", 422);

    const before = await db.organization.findUnique({ where: { id }, select: { nameAr: true, status: true } });
    if (!before) return adminNotFound();
    await db.organization.update({
      where: { id },
      data: { status, ...(status !== "APPROVED" ? { isPublished: false } : {}) },
    });
    await recordAudit({
      actor,
      action: `org.${status.toLowerCase()}`,
      resourceType: "Organization",
      resourceId: id,
      summary: `${status === "APPROVED" ? "اعتمد" : status === "REJECTED" ? "رفض" : "أوقف"} الجهة "${before.nameAr}"`,
      metadata: { from: before.status, to: status, reason: reason ?? null },
    });
    return ok({ status });
  });
}
