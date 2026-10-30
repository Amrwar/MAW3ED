import { z } from "zod";
import { ok, err, requireBusiness } from "@/lib/api";
import { requestPublish, unpublish } from "@/lib/business/publish";
import { log } from "@/lib/logger";

/**
 * POST /api/business/publish  { action: "publish" | "unpublish" }
 *
 * Owner only. Publishing goes through the readiness checklist
 * (lib/business/publish.ts): a business that is not ready gets 409 with
 * the list of what is missing, and a request that waits only on the
 * email confirmation is kept so the confirmation link completes it.
 */
const schema = z.object({ action: z.enum(["publish", "unpublish"]) });

export async function POST(req: Request) {
  try {
    const { business } = await requireBusiness();
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return err("طلب غير صالح", 422);

    if (parsed.data.action === "unpublish") {
      await unpublish(business.id);
      return ok({ published: false });
    }

    const result = await requestPublish(business.id);
    if (result.published) return ok(result);
    if (result.reason === "missing") {
      return err(
        result.waitingForEmail
          ? "فاضل تأكيد الإيميل بس. أول ما تفتح الرابط هتتنشر صفحتك تلقائي."
          : "لسه في حاجات مطلوبة قبل النشر",
        409,
        { code: result.waitingForEmail ? "waiting-for-email" : "not-ready", missing: result.missing },
      );
    }
    if (result.reason === "blocked") {
      return err("الصفحة موقوفة من الإدارة. كلّم الدعم.", 409, { code: "blocked", status: result.status });
    }
    return err("لم يتم العثور على عملك", 404);
  } catch (e) {
    if (e instanceof Response) return e;
    log.error("[business publish]", e);
    return err("حصلت مشكلة عندنا، جرّب تاني بعد شوية", 500);
  }
}
