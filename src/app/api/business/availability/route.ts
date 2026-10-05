import { db } from "@/lib/db";
import { availabilitySchema } from "@/lib/validations";
import { ok, err, requireBusiness } from "@/lib/api";
import { log } from "@/lib/logger";

/** GET /api/business/availability */
export async function GET() {
  try {
    const { business } = await requireBusiness();

    const rules = await db.availabilityRule.findMany({
      where:   { businessId: business.id },
      orderBy: { dayOfWeek: "asc" },
    });

    return ok(rules);
  } catch (e) {
    if (e instanceof Response) return e;
    log.error("[availability GET]", e);
    return err("حدث خطأ", 500);
  }
}

/** PUT /api/business/availability — replace full week */
export async function PUT(req: Request) {
  try {
    const { business } = await requireBusiness();
    const body = await req.json();
    const parsed = availabilitySchema.safeParse(body);
    if (!parsed.success) return err(parsed.error.issues[0].message, 422);

    // Replace all availability rules in a transaction
    const rules = await db.$transaction(async (tx) => {
      await tx.availabilityRule.deleteMany({
        where: { businessId: business.id },
      });

      await tx.availabilityRule.createMany({
        data: parsed.data.availability.map((day) => ({
          businessId: business.id,
          ...day,
        })),
      });

      return tx.availabilityRule.findMany({
        where:   { businessId: business.id },
        orderBy: { dayOfWeek: "asc" },
      });
    });

    return ok(rules);
  } catch (e) {
    if (e instanceof Response) return e;
    log.error("[availability PUT]", e);
    return err("حدث خطأ أثناء التحديث", 500);
  }
}
