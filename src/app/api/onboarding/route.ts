import { db } from "@/lib/db";
import { onboardingSchema } from "@/lib/validations";
import { ok, err, requireSession } from "@/lib/api";

export async function POST(req: Request) {
  try {
    const session = await requireSession().catch(() => null);
    if (!session) return err("غير مصرح", 401);

    const body = await req.json();
    const parsed = onboardingSchema.safeParse(body);
    if (!parsed.success) {
      return err(parsed.error.issues[0].message, 422);
    }

    const {
      nameAr, nameEn, categoryId, cityId,
      phone, whatsapp, address, taglineAr, about,
      services, availability, slug,
    } = parsed.data;

    // Ensure user doesn't already have a business
    const existing = await db.business.findUnique({
      where: { ownerId: session.user.id },
    });
    if (existing) return err("لديك عمل مسجل بالفعل", 409);

    // Check slug uniqueness
    const slugTaken = await db.business.findUnique({ where: { slug } });
    if (slugTaken) return err("هذا الرابط محجوز، جرّب رابطًا آخر", 409);

    // Create business + services + availability in a single transaction
    const business = await db.$transaction(async (tx) => {
      const biz = await tx.business.create({
        data: {
          slug, nameAr, nameEn, taglineAr, phone, whatsapp, address, about,
          ownerId:    session.user.id,
          categoryId, cityId,
          isPublished: true,
        },
      });

      // Create services
      if (services.length > 0) {
        await tx.service.createMany({
          data: services.map((s, i) => ({
            businessId:   biz.id,
            nameAr:       s.nameAr,
            nameEn:       s.nameEn,
            descriptionAr: s.descriptionAr,
            duration:     s.duration,
            price:        s.price,
            sortOrder:    i,
          })),
        });
      }

      // Create weekly availability (upsert pattern)
      await tx.availabilityRule.createMany({
        data: availability.map((day) => ({
          businessId: biz.id,
          dayOfWeek:  day.dayOfWeek,
          openTime:   day.openTime,
          closeTime:  day.closeTime,
          isClosed:   day.isClosed,
        })),
      });

      return biz;
    });

    return ok({ business: { id: business.id, slug: business.slug } }, 201);
  } catch (e) {
    console.error("[onboarding]", e);
    return err("حدث خطأ أثناء حفظ البيانات", 500);
  }
}
