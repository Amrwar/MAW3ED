import { z } from "zod";
import { db } from "@/lib/db";
import { ok, err, requireSession } from "@/lib/api";
import { verifyLoginCode } from "@/lib/auth/login-code";
import { deleteCustomerAccount } from "@/lib/account/deletion";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { log } from "@/lib/logger";

const schema = z.object({
  code: z.string().trim().min(4).max(10),
  /** The customer chose this themselves; a stray request cannot. */
  confirm: z.literal("DELETE"),
});

/**
 * POST /api/account/delete
 *
 * Step two: the code from /api/account/delete/code, checked against the
 * account's own phone, then the account goes — see lib/account/deletion
 * for exactly what that removes and what stays with the businesses.
 *
 * Every app session goes with it (they cascade), so the next refresh
 * fails and the app signs out.
 */
export async function POST(req: Request) {
  try {
    const session = await requireSession();

    const limited = await rateLimit("phoneOtp");
    if (!limited.ok) return tooManyRequests(limited);

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return err("اكتب الكود وأكّد الحذف", 422, { code: "invalid" });

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { phone: true },
    });
    if (!user?.phone) return err("محتاجين رقم موبايل متأكد", 409, { code: "no-phone" });

    const check = await verifyLoginCode(user.phone, parsed.data.code);
    if (!check.ok) return err("الكود غير صحيح أو انتهت صلاحيته", 401, { code: "wrong-code" });

    const result = await deleteCustomerAccount(session.user.id);
    if (!result.ok) {
      if (result.reason === "owns-business") {
        return err("الحساب ده مربوط بنشاط. كلّم الدعم عشان تقفل النشاط الأول.", 409, { code: "owns-business" });
      }
      if (result.reason === "admin") return err("حساب الإدارة مايتحذفش من هنا", 409, { code: "admin" });
      return err("غير مصرح", 401);
    }

    return ok({ deleted: true });
  } catch (e) {
    if (e instanceof Response) return e;
    log.error("[account delete]", e);
    return err("حصل خطأ ومتحذفش الحساب. حاول تاني.", 500);
  }
}
