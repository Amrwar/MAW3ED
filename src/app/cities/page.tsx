import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Container from "@/components/ui/Container";
import { getCities } from "@/lib/data";
import { MapPin } from "lucide-react";

export const metadata: Metadata = {
  title: "المدن | موعد",
  description: "تصفح الأعمال والخدمات في مدينتك على منصة موعد.",
};

// Decorative colors for city cards
const cityColors = [
  "bg-blue-50 text-blue-600",
  "bg-green-50 text-green-600",
  "bg-purple-50 text-purple-600",
  "bg-orange-50 text-orange-600",
  "bg-pink-50 text-pink-600",
  "bg-teal-50 text-teal-600",
  "bg-amber-50 text-amber-600",
  "bg-rose-50 text-rose-600",
  "bg-indigo-50 text-indigo-600",
  "bg-cyan-50 text-cyan-600",
];

export default async function CitiesPage() {
  const cities = await getCities();

  return (
    <>
      <Navbar />
      <main className="pt-16 min-h-screen">
        {/* Header */}
        <section className="bg-[var(--color-surface-2)] border-b border-[var(--color-border)] py-14">
          <Container>
            <div className="text-center max-w-xl mx-auto">
              <p className="section-eyebrow mb-2">اكتشف</p>
              <h1 className="section-title mb-4">تصفح حسب المدينة</h1>
              <p className="section-subtitle mx-auto">
                اختر مدينتك واكتشف أفضل الأعمال والخدمات المتاحة بالقرب منك.
              </p>
            </div>
          </Container>
        </section>

        {/* Cities grid */}
        <section className="section-padding">
          <Container>
            {cities.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {cities.map((city, i) => (
                  <Link
                    key={city.id}
                    href={`/businesses?city=${city.id}`}
                    className="card p-5 flex flex-col items-center text-center hover:border-[var(--color-accent)] hover:shadow-md transition-all duration-200 group"
                  >
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-200 ${
                        cityColors[i % cityColors.length]
                      }`}
                    >
                      <MapPin size={20} />
                    </div>
                    <h2 className="font-semibold text-sm text-[var(--color-text-primary)]">
                      {city.nameAr}
                    </h2>
                  </Link>
                ))}
              </div>
            ) : (
              <StaticCitiesGrid />
            )}
          </Container>
        </section>

        {/* CTA */}
        <section className="section-padding bg-[var(--color-surface-2)]">
          <Container>
            <div className="text-center max-w-lg mx-auto">
              <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-3">
                لا تجد مدينتك؟
              </h2>
              <p className="text-[var(--color-text-secondary)] mb-6">
                تصفح جميع الأعمال المتاحة على المنصة.
              </p>
              <Link href="/businesses" className="btn btn-primary btn-lg">
                تصفح جميع الأعمال
              </Link>
            </div>
          </Container>
        </section>
      </main>
      <Footer />
    </>
  );
}

function StaticCitiesGrid() {
  const staticCities = [
    "القاهرة", "الإسكندرية", "الجيزة", "الشرقية", "المنوفية",
    "البحيرة", "المنيا", "أسيوط", "سوهاج", "قنا",
    "الأقصر", "أسوان", "الدقهلية", "كفر الشيخ", "دمياط",
    "بورسعيد", "الإسماعيلية", "السويس", "مطروح", "الوادي الجديد",
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {staticCities.map((city, i) => (
        <Link
          key={city}
          href={`/businesses?q=${city}`}
          className="card p-5 flex flex-col items-center text-center hover:border-[var(--color-accent)] hover:shadow-md transition-all duration-200 group"
        >
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-200 ${
              cityColors[i % cityColors.length]
            }`}
          >
            <MapPin size={20} />
          </div>
          <h2 className="font-semibold text-sm text-[var(--color-text-primary)]">
            {city}
          </h2>
        </Link>
      ))}
    </div>
  );
}
