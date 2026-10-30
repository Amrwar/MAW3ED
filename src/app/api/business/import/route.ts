import { z } from "zod";
import { db } from "@/lib/db";
import { ok, err, requireBusiness } from "@/lib/api";
import { log } from "@/lib/logger";
import { MAX_BYTES } from "@/lib/import/csv";
import { planImport, commitImport } from "@/lib/import/run";

/**
 * GET  /api/business/import         recent import batches
 * POST /api/business/import         { kind, csv, fileName?, mode }
 *
 * mode "preview" validates and reports — nothing is written. mode
 * "commit" runs the very same validation again on the server (the
 * preview the browser holds is never trusted) and writes the valid rows
 * plus a batch record that can be rolled back.
 *
 * Owner only, and only into the owner's own business.
 */

const schema = z.object({
  kind: z.enum(["CUSTOMERS", "SERVICES"]),
  csv: z.string().min(1).max(MAX_BYTES),
  fileName: z.string().max(200).optional().nullable(),
  mode: z.enum(["preview", "commit"]),
});

/** What the browser is shown: the first rows, every error and duplicate. */
const PREVIEW_ROWS = 50;

export async function GET() {
  try {
    const { business } = await requireBusiness();
    const batches = await db.importBatch.findMany({
      where: { businessId: business.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        kind: true,
        fileName: true,
        rowCount: true,
        skipped: true,
        createdAt: true,
        rolledBackAt: true,
        rolledBackCount: true,
      },
    });
    return ok({
      batches: batches.map((b) => ({
        ...b,
        createdAt: b.createdAt.toISOString(),
        rolledBackAt: b.rolledBackAt?.toISOString() ?? null,
      })),
    });
  } catch (e) {
    if (e instanceof Response) return e;
    log.error("[import GET]", e);
    return err("حصلت مشكلة عندنا، جرّب تاني بعد شوية", 500);
  }
}

export async function POST(req: Request) {
  try {
    const { session, business } = await requireBusiness();
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return err("الملف فاضي أو أكبر من ١ ميجا", 422);
    const { kind, csv, fileName, mode } = parsed.data;

    const plan = await planImport(kind, business.id, csv);
    const summary = {
      total: plan.total,
      valid: plan.rows.length,
      errors: plan.errors,
      duplicates: plan.duplicates,
    };

    if (mode === "preview") {
      return ok({ ...summary, preview: plan.rows.slice(0, PREVIEW_ROWS) });
    }
    if (plan.rows.length === 0) {
      return err("مفيش صفوف صالحة للاستيراد", 422, { code: "nothing-to-import", ...summary });
    }
    const batch = await commitImport({
      kind,
      businessId: business.id,
      userId: session.user.id,
      fileName: fileName ?? null,
      plan,
    });
    return ok({ ...summary, batch: { ...batch, createdAt: batch.createdAt.toISOString() } }, 201);
  } catch (e) {
    if (e instanceof Response) return e;
    log.error("[import POST]", e);
    return err("حصلت مشكلة عندنا، جرّب تاني بعد شوية", 500);
  }
}
