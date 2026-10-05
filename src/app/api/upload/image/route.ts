import { requireSession } from "@/lib/api";
import { uploadImageToCloudinary } from "@/lib/services/cloudinary";
import { ok, err } from "@/lib/api";
import { log } from "@/lib/logger";

const MAX_BYTES     = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * POST /api/upload/image
 *
 * Accepts multipart/form-data with:
 *   file   — the image file
 *   folder — optional Cloudinary folder (default: "maw3ed/businesses")
 *
 * Auth required (any logged-in user with a session).
 * Returns { url: string } on success.
 */
export async function POST(req: Request) {
  try {
    await requireSession();

    const formData = await req.formData();
    const file     = formData.get("file");
    const folder   = (formData.get("folder") as string | null) ?? "maw3ed/businesses";

    if (!file || !(file instanceof File)) return err("لم يتم رفع أي ملف", 400);
    if (!ALLOWED_TYPES.has(file.type))    return err("نوع الملف غير مدعوم. استخدم JPG أو PNG أو WebP", 415);
    if (file.size > MAX_BYTES)            return err("حجم الصورة يجب أن يكون أقل من 5MB", 413);

    const buffer = Buffer.from(await file.arrayBuffer());
    const url    = await uploadImageToCloudinary(buffer, file.name, folder);

    return ok({ url });
  } catch (e) {
    if (e instanceof Response) return e;
    log.error("[upload/image]", e);
    return err("حدث خطأ أثناء رفع الصورة، حاول مرة أخرى", 500);
  }
}
