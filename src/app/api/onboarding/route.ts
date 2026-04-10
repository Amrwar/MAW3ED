import { db } from "@/lib/db";
import { onboardingSchema } from "@/lib/validations";
import { ok, err, requireSession } from "@/lib/api";
import { cookies } from "next/headers";
import crypto from "crypto";

/** Generate a unique 8-char uppercase hex referral code. */
async function generateReferralCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = crypto.randomBytes(4).toString("hex").toUpperCase();
    const exists = await db.business.findUnique({
      where:  { referralCode: candidate },
      select: { id: true },
    });
    if (!exists) return candidate;
  }
  // Extremely unlikely — fall back to longer code
  return crypto.randomBytes(8).toString("hex").toUpperCase();
}

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
      coverImage, logoImage,
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

    // Determine businessType from category slug
    const category = await db.category.findUnique({
      where:  { id: categoryId },
      select: { slug: true },
    });
    const businessType =
      category?.slug === "restaurants" ? "RESTAURANT"
      : (category?.slug === "salons" || category?.slug === "beauty-centers") ? "BARBERSHOP"
      : "GENERAL";

    // Resolve referral — read cookie set by /ref/[code]
    const cookieStore  = await cookies();
    const refCode      = cookieStore.get("maw3ed_ref")?.value ?? null;
    let   referredById: string | null = null;

    if (refCode) {
      const referrer = await db.business.findUnique({
        where:  { referralCode: refCode },
        select: { id: true, ownerId: true },
      });
      // Prevent self-referral (different account, same person using two accounts)
      if (referrer && referrer.ownerId !== session.user.id) {
        referredById = referrer.id;
      }
    }

    // Pre-generate a unique referral code for the new business
    const referralCode = await generateReferralCode();

    // Create business + services + availability in a single transaction
    const business = await db.$transaction(async (tx) => {
      const biz = await tx.business.create({
        data: {
          slug, nameAr, nameEn, taglineAr, phone, whatsapp, address, about,
          coverImage:   coverImage  ?? null,
          logoImage:    logoImage   ?? null,
          ownerId:      session.user.id,
          categoryId,   cityId,
          businessType,
          isPublished: true,
          referralCode,
          referredById: referredById ?? undefined,
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

    // Clear referral cookie so it isn't accidentally reused
    if (refCode) cookieStore.delete("maw3ed_ref");

    return ok({ business: { id: business.id, slug: business.slug } }, 201);
  } catch (e) {
    console.error("[onboarding]", e);
    return err("حدث خطأ أثناء حفظ البيانات", 500);
  }
}
