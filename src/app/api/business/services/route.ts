import { db } from "@/lib/db";
import { serviceSchema } from "@/lib/validations";
import { ok, err, requireBusiness } from "@/lib/api";

/** GET /api/business/services */
export async function GET() {
  try {
    const { business } = await requireBusiness();

    const services = await db.service.findMany({
      where:   { businessId: business.id },
      orderBy: { sortOrder: "asc" },
    });

    return ok(services);
  } catch (e) {
    if (e instanceof Response) return e;
    return err("حدث خطأ", 500);
  }
}

/** POST /api/business/services */
export async function POST(req: Request) {
  try {
    const { business } = await requireBusiness();
    const body = await req.json();
    const parsed = serviceSchema.safeParse(body);
    if (!parsed.success) return err(parsed.error.issues[0].message, 422);

    const count = await db.service.count({ where: { businessId: business.id } });

    const service = await db.service.create({
      data: {
        ...parsed.data,
        businessId: business.id,
        sortOrder:  count,
      },
    });

    return ok(service, 201);
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("[services POST]", e);
    return err("حدث خطأ أثناء إضافة الخدمة", 500);
  }
}
