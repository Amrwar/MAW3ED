/**
 * Realistic content for layout and responsive QA.
 *
 * qa-fixtures.mjs makes the accounts a functional pass needs; the pages
 * it leaves behind are nearly empty, and an empty page cannot overflow.
 * This fills them the way a real listing fills them: long Arabic and
 * English names, photos, many services, branches, staff, and reviews
 * long enough to wrap — the content that breaks a layout.
 *
 * Run after qa-fixtures.mjs. LOCAL databases only, for the same reason:
 *
 *   node scripts/qa-layout-fixtures.mjs
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL ?? "";
const host = (() => {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
})();

if (!["localhost", "127.0.0.1", "::1"].includes(host)) {
  console.error(`Refusing to run: DATABASE_URL points at "${host}", not a local database.`);
  process.exit(2);
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

const photo = (id, w = 1600) => `https://images.unsplash.com/photo-${id}?w=${w}&q=70`;
const PHOTOS = [
  "1560066984-138dadb4c035",
  "1521590832167-7bcbfaa6381f",
  "1503951914875-452162b0f3f1",
  "1600948836101-f9ffda59d250",
  "1519415943484-9fa1873496d4",
  "1487412947147-5cebf100ffc2",
];

const SERVICES = [
  ["قص شعر", "Haircut", 30, 150],
  ["صبغة شعر كاملة مع علاج الكيراتين والبروتين للشعر التالف", "Full colour with keratin and protein treatment for damaged hair", 120, 1850],
  ["تسريحة سهرة", "Evening styling", 60, 450],
  ["مانيكير وباديكير", "Manicure and pedicure", 75, 380],
  ["تنظيف بشرة عميق", "Deep facial cleansing", 50, 600],
  ["حلاقة ذقن", "Beard trim", 20, 90],
  ["باقة العروس الكاملة", "Complete bridal package", 240, 12500],
  ["استشارة مجانية", "Free consultation", 15, 0],
];

const REVIEWS = [
  [5, "خدمة ممتازة جدا والمكان نظيف ومنظم، والموظفين محترمين جدا. أنصح به بشدة لكل من يبحث عن جودة عالية وسعر مناسب."],
  [4, "Great experience overall. The stylist listened carefully to what I wanted and the result was exactly right, though I waited about ten minutes past my booking time."],
  [5, "رائع"],
  [3, "الخدمة جيدة لكن المكان كان مزدحم جدا يوم الجمعة والانتظار طال. Booking online was easy though — the confirmation came immediately."],
  [5, "Absolutely wonderful — will be back. https://example.com/a-very-long-link-that-should-wrap-and-not-overflow-the-card-on-a-narrow-phone-screen"],
  [2, "الموعد اتأخر كتير ومحدش اعتذر."],
];

async function main() {
  const cats = await db.category.findMany({ where: { parentId: null } });
  const cities = await db.city.findMany({ take: 6 });
  const cairo = cities.find((c) => c.slug === "cairo") ?? cities[0];

  // ── The main QA business: everything a profile page can show ──────
  const main = await db.business.update({
    where: { slug: "qa-salon" },
    data: {
      nameAr: "صالون كيو إيه للتجميل والعناية بالشعر والبشرة",
      nameEn: "QA Beauty, Hair and Skin Care Salon",
      taglineAr: "أفضل تجربة تجميل في القاهرة منذ ٢٠١٠",
      about:
        "نقدم جميع خدمات التجميل والعناية بالشعر والبشرة على أيدي فريق محترف. We also welcome English-speaking clients. " +
        "مواعيدنا مرنة ونستقبل الحجوزات أونلاين على مدار الساعة.",
      coverImage: photo(PHOTOS[0]),
      logoImage: photo(PHOTOS[1], 300),
      status: "APPROVED",
      isVerified: true,
      ratingAvg: 4.2,
      ratingCount: REVIEWS.length,
      address: "١٢ شارع التسعين الشمالي، التجمع الخامس، القاهرة الجديدة، بجوار مول كايرو فستيفال",
      whatsapp: "01000000009",
    },
  });

  for (let i = 0; i < SERVICES.length; i++) {
    const [nameAr, nameEn, duration, price] = SERVICES[i];
    await db.service.upsert({
      where: { id: `qa-salon-svc-${i}` },
      update: {},
      create: {
        id: `qa-salon-svc-${i}`,
        businessId: main.id,
        nameAr,
        nameEn,
        duration,
        price,
        currency: "EGP",
        isAvailable: true,
        sortOrder: i + 1,
        descriptionAr: i === 1 ? "تشمل غسيل وتجفيف وتصفيف. النتيجة تدوم حتى ستة أشهر مع العناية المناسبة." : null,
      },
    });
  }

  for (const [i, [nameAr, nameEn, role]] of [
    ["سارة محمد", "Sara Mohamed", "Senior stylist"],
    ["عبد الرحمن إبراهيم السيد", "Abdelrahman Ibrahim El-Sayed", "Colour specialist"],
    ["منى", "Mona", null],
  ].entries()) {
    await db.staffMember.upsert({
      where: { id: `qa-salon-staff-${i}` },
      update: {},
      create: { id: `qa-salon-staff-${i}`, businessId: main.id, nameAr, nameEn, role, isActive: true },
    });
  }

  for (const [i, [nameAr, nameEn, address]] of [
    ["فرع التجمع الخامس", "Fifth Settlement branch", "التسعين الشمالي"],
    ["فرع مدينة نصر - عباس العقاد", "Nasr City — Abbas El-Akkad branch", "شارع عباس العقاد"],
  ].entries()) {
    await db.branch.upsert({
      where: { id: `qa-salon-branch-${i}` },
      update: {},
      create: { id: `qa-salon-branch-${i}`, businessId: main.id, nameAr, nameEn, address, isActive: true, sortOrder: i },
    });
  }

  for (let i = 0; i < 4; i++) {
    await db.businessImage.upsert({
      where: { id: `qa-salon-img-${i}` },
      update: {},
      create: { id: `qa-salon-img-${i}`, businessId: main.id, url: photo(PHOTOS[(i + 2) % PHOTOS.length]), sortOrder: i },
    });
  }

  // A review needs a completed booking behind it.
  for (let i = 0; i < REVIEWS.length; i++) {
    const day = new Date();
    day.setUTCDate(day.getUTCDate() - (i + 3));
    const date = new Date(day.toISOString().slice(0, 10) + "T00:00:00Z");
    const booking = await db.booking.upsert({
      where: { id: `qa-review-booking-${i}` },
      update: {},
      create: {
        id: `qa-review-booking-${i}`,
        businessId: main.id,
        serviceId: "qa-salon-svc",
        customerName: ["Layla A.", "منى ح.", "Omar K.", "يوسف", "Nour", "أحمد س."][i],
        customerPhone: `0100000010${i}`,
        date,
        startTime: "11:00",
        endTime: "11:30",
        startsAt: new Date(date.getTime() + 9 * 3600e3),
        endsAt: new Date(date.getTime() + 9.5 * 3600e3),
        status: "COMPLETED",
        totalPrice: 150,
        currency: "EGP",
      },
    });
    const [rating, comment] = REVIEWS[i];
    await db.review.upsert({
      where: { bookingId: booking.id },
      update: {},
      create: {
        businessId: main.id,
        bookingId: booking.id,
        rating,
        comment,
        status: "PUBLISHED",
        response: i % 2 === 0 ? "شكرا جزيلا على تقييمك، سعداء بخدمتك دائما!" : null,
        respondedAt: i % 2 === 0 ? new Date() : null,
      },
    });
  }

  // ── A browse page's worth of other businesses ─────────────────────
  const names = [
    ["عيادة د. أحمد لطب الأسنان وتجميل الابتسامة", "Dr. Ahmed Dental & Smile Clinic"],
    ["جيم باور", "Power Gym"],
    ["مطعم بيت الكشري", null],
    ["مركز النور للتحاليل الطبية", "Al Nour Medical Labs"],
    ["سبا الواحة", "Oasis Spa"],
    ["مكتب المستشار القانوني محمود عبد العزيز وشركاه للمحاماة والاستشارات", "Mahmoud Abdelaziz & Partners Law Office"],
    ["ستوديو لقطة للتصوير", "Laqta Photo Studio"],
    ["باربر شوب الأسطى", "Al Osta Barbershop"],
    ["مركز سيارتك لخدمة السيارات", "Your Car Service Centre"],
    ["أكاديمية المستقبل", "Future Academy"],
  ];
  for (let i = 0; i < names.length; i++) {
    const [nameAr, nameEn] = names[i];
    const slug = `qa-listing-${i}`;
    const b = await db.business.upsert({
      where: { slug },
      update: {},
      create: {
        slug,
        nameAr,
        nameEn,
        ownerId: (await ownerFor(i)).id,
        categoryId: cats[i % cats.length].id,
        cityId: i < 6 ? cairo.id : cities[i % cities.length].id,
        isPublished: true,
        status: "APPROVED",
        plan: i % 3 === 0 ? "PREMIUM" : "PRO",
        subscriptionStatus: "ACTIVE",
        coverImage: i === 2 ? null : photo(PHOTOS[i % PHOTOS.length], 1200),
        ratingAvg: i === 4 ? null : 3.5 + (i % 4) * 0.4,
        ratingCount: i === 4 ? 0 : 7 + i * 13,
        isVerified: i % 2 === 0,
        address: "القاهرة",
      },
    });
    await db.service.upsert({
      where: { id: `${slug}-svc` },
      update: {},
      create: { id: `${slug}-svc`, businessId: b.id, nameAr: "خدمة", nameEn: "Service", duration: 30, price: 200 + i * 50, currency: "EGP", isAvailable: true },
    });
  }

  console.log("layout fixtures ready");
}

// ownerId is unique on Business, so each listing needs its own owner.
async function ownerFor(i) {
  return db.user.upsert({
    where: { email: `listing${i}@qa.test` },
    update: {},
    create: { email: `listing${i}@qa.test`, name: `QA Listing Owner ${i}` },
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
