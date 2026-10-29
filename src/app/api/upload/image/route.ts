import { requireSession } from "@/lib/api";
import { uploadImageToCloudinary } from "@/lib/services/cloudinary";
import { ok, err } from "@/lib/api";
import { log } from "@/lib/logger";
import { UPLOAD_FOLDERS, sniffImageType } from "@/lib/security/image-sniff";

const MAX_BYTES     = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * POST /api/upload/image
 *
 * Accepts multipart/form-data with:
 *   file   — the image file
 *   folder — optional Cloudinary folder (default: "maw3ed/businesses"),
 *            one of a fixed list
 *
 * Auth required (any logged-in user with a session).
 * Returns { url: string } on success.
 *
 * The file's declared type is not believed on its own: the first bytes
 * have to be a JPEG, PNG or WebP as well, so an SVG or an HTML page
 * renamed ".png" is turned away rather than stored and served from the
 * media host. The folder is checked against a list for the same
 * reason — the client may group an owner's media, not choose where in
 * the store it goes.
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
    if (!UPLOAD_FOLDERS.has(folder))      return err("مجلد غير معروف", 400);

    const buffer = Buffer.from(await file.arrayBuffer());
    const actual = sniffImageType(buffer.subarray(0, 16));
    if (actual !== file.type) return err("الملف مش صورة من النوع المذكور", 415, { code: "not-an-image" });

    const url    = await uploadImageToCloudinary(buffer, file.name, folder);

    return ok({ url });
  } catch (e) {
    if (e instanceof Response) return e;
    log.error("[upload/image]", e);
    return err("حدث خطأ أثناء رفع الصورة، حاول مرة أخرى", 500);
  }
}
