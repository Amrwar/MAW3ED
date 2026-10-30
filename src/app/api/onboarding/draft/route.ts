import { z } from "zod";
import { db } from "@/lib/db";
import { ok, err, requireSession } from "@/lib/api";
import { log } from "@/lib/logger";
import { recordMilestone } from "@/lib/business/lifecycle";

/**
 * The onboarding wizard's saved progress, on the server.
 *
 * It used to live only in the browser's localStorage, so starting on a
 * phone and finishing on a laptop meant starting again — and clearing
 * the browser lost it. Now every step is saved here as the owner goes,
 * and the wizard resumes from it on any device. The browser copy stays
 * as an offline fallback.
 *
 * The data is the wizard's own shape and is only checked loosely here
 * (size, step range): it is half-finished by definition. The full
 * validation runs once, when the business is created
 * (POST /api/onboarding).
 *
 *   GET     the draft, or null
 *   PUT     { step, data } — save
 *   DELETE  start over
 */

/** A draft bigger than this is not a business, it is a payload. */
const MAX_BYTES = 64 * 1024;

const schema = z.object({
  step: z.number().int().min(1).max(10),
  data: z.record(z.string(), z.unknown()),
});

async function ownerWithoutBusiness() {
  const session = await requireSession();
  const has = await db.business.findUnique({ where: { ownerId: session.user.id }, select: { id: true } });
  if (has) throw err("لديك عمل مسجل بالفعل", 409, { code: "has-business" });
  return session.user.id;
}

export async function GET() {
  try {
    const session = await requireSession();
    const draft = await db.onboardingDraft.findUnique({
      where: { userId: session.user.id },
      select: { step: true, data: true, updatedAt: true },
    });
    return ok({ draft: draft ? { ...draft, updatedAt: draft.updatedAt.toISOString() } : null });
  } catch (e) {
    if (e instanceof Response) return e;
    log.error("[onboarding draft GET]", e);
    return err("حصلت مشكلة عندنا، جرّب تاني بعد شوية", 500);
  }
}

export async function PUT(req: Request) {
  try {
    const userId = await ownerWithoutBusiness();
    const raw = await req.text();
    if (raw.length > MAX_BYTES) return err("المسودة كبيرة جدًا", 413);
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return err("طلب غير صالح", 422);
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) return err("طلب غير صالح", 422);

    const { step, data } = parsed.data;
    const saved = await db.onboardingDraft.upsert({
      where: { userId },
      create: { userId, step, data: data as object },
      update: { step, data: data as object },
      select: { updatedAt: true },
    });
    await recordMilestone("ONBOARDING_STARTED", { userId });
    return ok({ savedAt: saved.updatedAt.toISOString() });
  } catch (e) {
    if (e instanceof Response) return e;
    log.error("[onboarding draft PUT]", e);
    return err("حصلت مشكلة عندنا، جرّب تاني بعد شوية", 500);
  }
}

export async function DELETE() {
  try {
    const session = await requireSession();
    await db.onboardingDraft.deleteMany({ where: { userId: session.user.id } });
    return ok({ deleted: true });
  } catch (e) {
    if (e instanceof Response) return e;
    log.error("[onboarding draft DELETE]", e);
    return err("حصلت مشكلة عندنا، جرّب تاني بعد شوية", 500);
  }
}
