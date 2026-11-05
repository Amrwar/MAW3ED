import { db } from "@/lib/db";
import { ok, err } from "@/lib/api";
import { localText } from "@/lib/api-lang";
import { log } from "@/lib/logger";

/** GET /api/business/check-slug?slug=bella-salon */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get("slug")?.trim().toLowerCase();

    if (!slug || slug.length < 3) {
      return ok({ available: false, message: await localText("الرابط قصير جدًا", req) });
    }

    if (!/^[a-z0-9-]+$/.test(slug) || slug.startsWith("-") || slug.endsWith("-")) {
      return ok({
        available: false,
        message: await localText("يجب أن يحتوي الرابط على أحرف إنجليزية صغيرة وأرقام وشرطات فقط", req),
      });
    }

    const existing = await db.business.findUnique({ where: { slug } });
    return ok({ available: !existing });
  } catch (e) {
    log.error("[check-slug]", e);
    return err("حصلت مشكلة عندنا، جرّب تاني بعد شوية", 500);
  }
}
