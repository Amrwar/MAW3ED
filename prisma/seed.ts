import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

// Same rule as src/lib/db.ts: Neon's adapter speaks to Neon's proxy, so
// a local Postgres needs the plain one. Chosen by the host in the URL,
// because what matters is which database is on the other end.
const connectionString = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "";
const isLocal = /^postgres(ql)?:\/\/[^@]*@(localhost|127\.0\.0\.1)[:/]/.test(connectionString);
const adapter = isLocal
  ? new PrismaPg({ connectionString })
  : new PrismaNeon({ connectionString });
const db = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding database...");

  // ─── Categories ───────────────────────────────────────────
  const categories = [
    // Medical
    { slug: "clinics",        nameAr: "عيادات طبية",       nameEn: "Clinics",          icon: "🏥", color: "#0EA5E9", bgColor: "#F0F9FF" },
    { slug: "dentists",       nameAr: "طب أسنان",           nameEn: "Dentistry",        icon: "🦷", color: "#06B6D4", bgColor: "#ECFEFF" },
    { slug: "labs",           nameAr: "مختبرات وتحاليل",    nameEn: "Medical Labs",     icon: "🔬", color: "#EF4444", bgColor: "#FEF2F2" },

    // Beauty & Wellness
    { slug: "salons",         nameAr: "صالونات حلاقة",     nameEn: "Salons",           icon: "✂️", color: "#EC4899", bgColor: "#FDF2F8" },
    { slug: "beauty-centers", nameAr: "مراكز تجميل",       nameEn: "Beauty Centers",   icon: "💄", color: "#F472B6", bgColor: "#FFF0F6" },
    { slug: "spas",           nameAr: "سبا وتدليك",        nameEn: "Spa & Massage",    icon: "🧖", color: "#8B5CF6", bgColor: "#F5F3FF" },
    { slug: "gyms",           nameAr: "جيم وفيتنس",        nameEn: "Gyms & Fitness",   icon: "💪", color: "#10B981", bgColor: "#ECFDF5" },

    // Food & Hospitality
    { slug: "restaurants",    nameAr: "مطاعم وكافيهات",    nameEn: "Restaurants",      icon: "🍽️", color: "#F59E0B", bgColor: "#FFFBEB" },

    // Professional Services
    { slug: "consulting",     nameAr: "استشارات",           nameEn: "Consulting",       icon: "💼", color: "#6366F1", bgColor: "#EEF2FF" },
    { slug: "legal",          nameAr: "محاماة وقانون",      nameEn: "Legal",            icon: "⚖️", color: "#374151", bgColor: "#F9FAFB" },

    // Home & Auto
    { slug: "home-services",  nameAr: "خدمات منزلية",      nameEn: "Home Services",    icon: "🏠", color: "#D97706", bgColor: "#FFFBEB" },
    { slug: "car-services",   nameAr: "خدمات سيارات",      nameEn: "Car Services",     icon: "🚗", color: "#64748B", bgColor: "#F8FAFC" },

    // Creative
    { slug: "photography",    nameAr: "تصوير",              nameEn: "Photography",      icon: "📸", color: "#F97316", bgColor: "#FFF7ED" },
    { slug: "education",      nameAr: "تعليم وتدريب",       nameEn: "Education",        icon: "📚", color: "#7C3AED", bgColor: "#F5F3FF" },
  ];

  for (const cat of categories) {
    await db.category.upsert({
      where:  { slug: cat.slug },
      update: cat,
      create: cat,
    });
  }
  console.log(`✅ Seeded ${categories.length} categories`);

  // ─── Cities ───────────────────────────────────────────────
  const cities = [
    // Greater Cairo
    { slug: "cairo",            nameAr: "القاهرة",           nameEn: "Cairo" },
    { slug: "new-cairo",        nameAr: "القاهرة الجديدة",   nameEn: "New Cairo" },
    { slug: "nasr-city",        nameAr: "مدينة نصر",         nameEn: "Nasr City" },
    { slug: "heliopolis",       nameAr: "مصر الجديدة",       nameEn: "Heliopolis" },
    { slug: "maadi",            nameAr: "المعادي",            nameEn: "Maadi" },
    { slug: "zamalek",          nameAr: "الزمالك",            nameEn: "Zamalek" },
    { slug: "dokki",            nameAr: "الدقي",              nameEn: "Dokki" },
    { slug: "mohandessin",      nameAr: "المهندسين",          nameEn: "Mohandessin" },

    // Giza & West Cairo
    { slug: "giza",             nameAr: "الجيزة",             nameEn: "Giza" },
    { slug: "sheikh-zayed",     nameAr: "الشيخ زايد",        nameEn: "Sheikh Zayed" },
    { slug: "october",          nameAr: "السادس من أكتوبر",  nameEn: "6th of October" },
    { slug: "haram",            nameAr: "الهرم",              nameEn: "Haram" },

    // Alexandria
    { slug: "alexandria",       nameAr: "الإسكندرية",        nameEn: "Alexandria" },
    { slug: "sidi-bishr",       nameAr: "سيدي بشر",          nameEn: "Sidi Bishr" },
    { slug: "smouha",           nameAr: "سموحة",              nameEn: "Smouha" },

    // Delta
    { slug: "mansoura",         nameAr: "المنصورة",           nameEn: "Mansoura" },
    { slug: "tanta",            nameAr: "طنطا",               nameEn: "Tanta" },
    { slug: "zagazig",          nameAr: "الزقازيق",           nameEn: "Zagazig" },
    { slug: "damanhur",         nameAr: "دمنهور",             nameEn: "Damanhur" },

    // Canal Zone
    { slug: "suez",             nameAr: "السويس",             nameEn: "Suez" },
    { slug: "ismailia",         nameAr: "الإسماعيلية",       nameEn: "Ismailia" },
    { slug: "port-said",        nameAr: "بورسعيد",            nameEn: "Port Said" },

    // Upper Egypt
    { slug: "assiut",           nameAr: "أسيوط",              nameEn: "Assiut" },
    { slug: "luxor",            nameAr: "الأقصر",             nameEn: "Luxor" },
    { slug: "aswan",            nameAr: "أسوان",              nameEn: "Aswan" },

    // Coasts
    { slug: "hurghada",         nameAr: "الغردقة",            nameEn: "Hurghada" },
    { slug: "sharm-el-sheikh",  nameAr: "شرم الشيخ",         nameEn: "Sharm El-Sheikh" },
  ];

  for (const city of cities) {
    await db.city.upsert({
      where:  { slug: city.slug },
      update: city,
      create: city,
    });
  }
  console.log(`✅ Seeded ${cities.length} cities`);

  console.log("🎉 Seeding complete!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
