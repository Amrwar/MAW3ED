import { Prisma } from "@prisma/client";
import { err } from "@/lib/api";
import { log } from "@/lib/logger";

/** One error shape for the Phase 27 business routes: a thrown Response passes through. */
export async function businessHandle(tag: string, fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2002") return err("حصل تعديل في نفس الوقت — جرّب تاني", 409, { code: "conflict" });
      if (e.code === "P2003" || e.code === "P2025") return err("مرجع غير موجود", 422, { code: "bad-reference" });
    }
    // A CHECK constraint is a rule the form should have caught.
    if (e instanceof Error && /violates check constraint/.test(e.message)) {
      return err("القيم دي خارج الحدود المسموحة", 422, { code: "out-of-bounds" });
    }
    log.error(`[${tag}]`, e);
    return err("حصلت مشكلة عندنا، جرّب تاني بعد شوية", 500);
  }
}

export async function readJson(req: Request): Promise<unknown> {
  return req.json().catch(() => null);
}
