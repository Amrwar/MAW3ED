import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // ─── Categories ───────────────────────────────────────────
  const categories = [
    { slug: "clinics",      nameAr: "عيادات",        nameEn: "Clinics",       icon: "🏥", color: "#0EA5E9", bgColor: "#F0F9FF" },
    { slug: "salons",       nameAr: "صالونات",       nameEn: "Salons",        icon: "✂️", color: "#EC4899", bgColor: "#FDF2F8" },
    { slug: "restaurants",  nameAr: "مطاعم",         nameEn: "Restaurants",   icon: "🍽️", color: "#F59E0B", bgColor: "#FFFBEB" },
    { slug: "gyms",         nameAr: "جيم وفيتنس",    nameEn: "Gyms",          icon: "💪", color: "#10B981", bgColor: "#ECFDF5" },
    { slug: "spas",         nameAr: "سبا وتدليك",    nameEn: "Spa",           icon: "🧖", color: "#8B5CF6", bgColor: "#F5F3FF" },
    { slug: "dentists",     nameAr: "طب أسنان",      nameEn: "Dentistry",     icon: "🦷", color: "#06B6D4", bgColor: "#ECFEFF" },
    { slug: "labs",         nameAr: "مختبرات",       nameEn: "Medical Labs",  icon: "🔬", color: "#EF4444", bgColor: "#FEF2F2" },
    { slug: "photography",  nameAr: "تصوير",         nameEn: "Photography",   icon: "📸", color: "#F97316", bgColor: "#FFF7ED" },
  ];

  for (const cat of categories) {
    await db.category.upsert({
      where: { slug: cat.slug },
      update: cat,
      create: cat,
    });
  }
  console.log(`✅ Seeded ${categories.length} categories`);

  // ─── Cities ───────────────────────────────────────────────
  const cities = [
    { slug: "cairo",        nameAr: "القاهرة",      nameEn: "Cairo" },
    { slug: "giza",         nameAr: "الجيزة",       nameEn: "Giza" },
    { slug: "alexandria",   nameAr: "الإسكندرية",   nameEn: "Alexandria" },
    { slug: "qalyubia",     nameAr: "القليوبية",    nameEn: "Qalyubia" },
    { slug: "sharqia",      nameAr: "الشرقية",      nameEn: "Sharqia" },
    { slug: "dakahlia",     nameAr: "الدقهلية",     nameEn: "Dakahlia" },
    { slug: "beheira",      nameAr: "البحيرة",      nameEn: "Beheira" },
    { slug: "minya",        nameAr: "المنيا",       nameEn: "Minya" },
    { slug: "asyut",        nameAr: "أسيوط",        nameEn: "Asyut" },
    { slug: "sohag",        nameAr: "سوهاج",        nameEn: "Sohag" },
    { slug: "luxor",        nameAr: "الأقصر",       nameEn: "Luxor" },
    { slug: "aswan",        nameAr: "أسوان",        nameEn: "Aswan" },
    { slug: "red-sea",      nameAr: "البحر الأحمر", nameEn: "Red Sea" },
    { slug: "suez",         nameAr: "السويس",       nameEn: "Suez" },
    { slug: "ismailia",     nameAr: "الإسماعيلية",  nameEn: "Ismailia" },
    { slug: "port-said",    nameAr: "بورسعيد",      nameEn: "Port Said" },
  ];

  for (const city of cities) {
    await db.city.upsert({
      where: { slug: city.slug },
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
