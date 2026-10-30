import type { Metadata } from "next";
import { Building2 } from "lucide-react";
import Link from "@/components/shared/LocaleLink";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { getLang } from "@/lib/lang-server";
import { buildMetadata } from "@/lib/seo/meta";
import { listPublicVenues } from "@/lib/venues/public";
import { kindLabel } from "@/lib/venues/seo";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLang();
  const venues = await listPublicVenues().catch(() => []);
  const meta =
    lang === "en"
      ? buildMetadata({ title: "Malls and destinations", description: "Malls, office complexes and destinations whose businesses take bookings on Maw3ed.", path: "/venues", lang })
      : buildMetadata({ title: "المولات والأماكن", description: "مولات ومجمعات وأماكن الأنشطة اللي جواها بتستقبل حجوزات على موعد.", path: "/venues" });
  // Nothing to index until a venue lists somebody — the same rule the
  // sitemap uses for this page and for each venue.
  return venues.some((v) => v.businesses > 0) ? meta : { ...meta, robots: { index: false, follow: true } };
}

export default async function VenuesIndex() {
  const [venues, lang] = await Promise.all([listPublicVenues(), getLang()]);
  const en = lang === "en";
  return (
    <>
      <Navbar />
      <main id="main" className="pb-16 pt-24">
        <div className="container-app max-w-5xl space-y-6 text-start" dir={en ? "ltr" : "rtl"} lang={lang}>
          <header className="space-y-1">
            <h1 className="m-0 text-3xl font-extrabold text-[var(--color-ink)]">{en ? "Malls and destinations" : "المولات والأماكن"}</h1>
            <p className="m-0 text-[var(--color-muted)]">
              {en ? "Find a place, then book the business inside it." : "لاقي المكان، واحجز في النشاط اللي جواه."}
            </p>
          </header>
          {venues.length === 0 ? (
            <p className="m-0 rounded-[var(--radius-lg)] border border-dashed border-[var(--color-line)] p-6 text-center text-sm text-[var(--color-subtle)]">
              {en ? "No destinations are listed yet." : "لسه مفيش أماكن معروضة."}
            </p>
          ) : (
            <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2">
              {venues.map((v) => (
                <li key={v.slug}>
                  <Link href={`/venues/${v.slug}`} className="card block h-full p-5 hover:border-[var(--color-jade)]">
                    <p className="m-0 flex items-center gap-2 text-xs text-[var(--color-subtle)]">
                      <Building2 size={14} aria-hidden="true" />
                      {kindLabel(v.kind, lang)} · {en ? v.city.nameEn || v.city.nameAr : v.city.nameAr}
                      {v.compound ? ` · ${en ? v.compound.nameEn || v.compound.nameAr : v.compound.nameAr}` : ""}
                    </p>
                    <p className="m-0 mt-1 text-lg font-bold text-[var(--color-ink)]">{en ? v.nameEn || v.nameAr : v.nameAr}</p>
                    <p className="m-0 mt-1 text-sm text-[var(--color-muted)]">
                      {en ? `${v.businesses} place(s) to book` : `${v.businesses} مكان تقدر تحجز فيه`}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
