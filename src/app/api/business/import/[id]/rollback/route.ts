import { ok, err, requireBusiness } from "@/lib/api";
import { log } from "@/lib/logger";
import { rollbackImport } from "@/lib/import/run";

/**
 * POST /api/business/import/:id/rollback
 *
 * Undoes one import batch of the caller's own business. Another
 * business's batch id answers 404, exactly like one that does not exist.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { business } = await requireBusiness();
    const { id } = await params;
    const result = await rollbackImport(id, business.id);
    if (!result.ok) {
      return result.reason === "not-found"
        ? err("الاستيراد ده مش موجود", 404)
        : err("الاستيراد ده اتلغى قبل كده", 409, { code: "already-rolled-back" });
    }
    return ok(result);
  } catch (e) {
    if (e instanceof Response) return e;
    log.error("[import rollback]", e);
    return err("حصلت مشكلة عندنا، جرّب تاني بعد شوية", 500);
  }
}
