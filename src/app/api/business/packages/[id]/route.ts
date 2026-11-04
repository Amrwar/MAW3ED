import { z } from "zod";
import { db } from "@/lib/db";
import { ok, err, requireBusiness } from "@/lib/api";
import { businessHandle, readJson } from "@/lib/business/route";

/** PATCH a package plan: on sale or not. A plan with sales is never deleted. */
const body = z.object({ isActive: z.boolean() });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return businessHandle("package plan PATCH", async () => {
    const { business } = await requireBusiness();
    const { id } = await params;
    const parsed = body.safeParse(await readJson(req));
    if (!parsed.success) return err("طلب غير صحيح", 422, { code: "invalid" });
    const { count } = await db.packagePlan.updateMany({ where: { id, businessId: business.id }, data: parsed.data });
    if (count !== 1) return err("غير موجود", 404);
    return ok({ ok: true });
  });
}
