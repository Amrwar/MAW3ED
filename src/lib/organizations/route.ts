import { Prisma } from "@prisma/client";
import { err } from "@/lib/api";
import { log } from "@/lib/logger";
import { AssociationFailure, ASSOCIATION_MESSAGES } from "./associations";

/** One error shape for every organization route. */
export async function orgHandle(tag: string, fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof AssociationFailure) {
      const m = ASSOCIATION_MESSAGES[e.code];
      return err(m.ar, m.status, { code: e.code });
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2002") return err("حصل تعديل في نفس الوقت — جرّب تاني", 409, { code: "conflict" });
      if (e.code === "P2003" || e.code === "P2025") return err("مرجع غير موجود", 422, { code: "bad-reference" });
    }
    log.error(`[${tag}]`, e);
    return err("حصلت مشكلة عندنا، جرّب تاني بعد شوية", 500);
  }
}

export async function readJson(req: Request): Promise<unknown> {
  return req.json().catch(() => null);
}
