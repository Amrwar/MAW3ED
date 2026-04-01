import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { MapPin, ArrowRight, Building2 } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Container from "@/components/ui/Container";
import PublicBusinessCard from "@/components/shared/PublicBusinessCard";
import { getCities, getCityBySlug, getPublishedBusinesses } from "@/lib/data";

type Props = { params: Promise<{ city: string }> };

export async function generateStaticParams() {
  const cities = await getCities();
  return cities.map((c) => ({ city: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city: slug } = await params;
  const city = await getCityBySlug(slug);
  if (!city) return {};
  return {
    title: `أعمال في ${city.nameAr} | موعد`,
    description: `اكتشف أفضل الأعمال والمواعيد في ${city.nameAr}. احجز حلاق، صالون، طبيب وأكثر بضغطة واحدة.`,
    openGraph: {
      title: `أعمال في ${city.nameAr} | موعد`,
      description: `اكتشف أفضل الأعمال والمواعيد في ${city.nameAr}.`,
    },
  };
}

export default async function CityPage({ params }: Props) {
  const { city: slug } = await params;

  const [city, businesses, allCities] = await Promise.all([
    getCityBySlug(slug),
    getPublishedBusinesses({ citySlug: slug }),
    getCities(),
  ]);

  if (!city) notFound();

  const otherCities = allCities.filter((c) => c.slug !== slug).slice(0, 6);

  return (
    <>
      <Navbar />
      <main className="pt-16 min-h-screen bg-[var(--color-surface-2)]">

        {/* ── Hero ─────────────────────────────────────────── */}
        <div className="bg-white border-b border-[var(--color-border)]">
          <Container className="py-10">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] mb-6">
              <Link href="/" className="hover:text-[var(--color-accent)] transition-colors">الرئيسية</Link>
              <span>/</span>
              <Link href="/businesses" className="hover:text-[var(--color-accent)] transition-colors">تصفح الأعمال</Link>
              <span>/</span>
              <span className="text-[var(--color-text-primary)] font-medium">{city.nameAr}</span>
            </nav>

            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-[var(--color-brand)]/10 flex items-center justify-center shrink-0">
                <MapPin size={26} className="text-[var(--color-brand)]" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-[var(--color-text-primary)]">
                  أعمال في {city.nameAr}
                </h1>
                <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
                  {businesses.length > 0
                    ? `${businesses.length} عمل متاح للحجز الآن`
                    : "لا توجد أعمال حتى الآن"}
                </p>
              </div>
            </div>
          </Container>
        </div>

        {/* ── Business grid ─────────────────────────────────── */}
        <Container className="py-10">
          {businesses.length > 0 ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {businesses.map((b) => (
                  <PublicBusinessCard key={b.id} business={b} />
                ))}
              </div>

              <div className="mt-8 text-center">
                <Link
                  href="/businesses"
                  className="inline-flex items-center gap-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
                >
                  <ArrowRight size={14} />
                  عرض كل الأعمال
                </Link>
              </div>
            </>
          ) : (
            <EmptyState cityName={city.nameAr} />
          )}

          {/* ── Other cities ──────────────────────────────── */}
          {otherCities.length > 0 && (
            <div className="mt-14">
              <h2 className="text-base font-bold text-[var(--color-text-primary)] mb-4">
                تصفح مدن أخرى
              </h2>
              <div className="flex flex-wrap gap-2">
                {otherCities.map((c) => (
                  <Link
                    key={c.id}
                    href={`/cities/${c.slug}`}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-white rounded-xl border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)] font-medium hover:border-[var(--color-brand)] hover:text-[var(--color-brand)] transition-all"
                  >
                    <MapPin size={13} />
                    {c.nameAr}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </Container>
      </main>
      <Footer />
    </>
  );
}

// ─── Empty state ──────────────────────────────────────────

function EmptyState({ cityName }: { cityName: string }) {
  return (
    <div className="text-center py-24 bg-white rounded-2xl border border-[var(--color-border)]">
      <div className="w-16 h-16 rounded-2xl bg-[var(--color-surface-2)] flex items-center justify-center mx-auto mb-4">
        <Building2 size={28} className="text-[var(--color-text-muted)]" />
      </div>
      <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-2">
        لا توجد أعمال في {cityName} حتى الآن
      </h2>
      <p className="text-sm text-[var(--color-text-muted)] mb-6 max-w-xs mx-auto">
        كن أول من يضيف عمله في {cityName} ويبدأ باستقبال حجوزات على الفور.
      </p>
      <div className="flex items-center justify-center gap-3">
        <Link href="/signup" className="btn btn-primary btn-sm">
          أضف عملك مجانًا
        </Link>
        <Link href="/businesses" className="btn btn-outline btn-sm">
          تصفح مدن أخرى
        </Link>
      </div>
    </div>
  );
}
