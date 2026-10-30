import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MapPin, Clock, Navigation, ShieldCheck, Info, Building2, Search, BadgeCheck, Phone, Globe } from "lucide-react";
import Link from "@/components/shared/LocaleLink";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Breadcrumbs from "@/components/shared/Breadcrumbs";
import { getLang } from "@/lib/lang-server";
import { buildMetadata, notFoundMetadata } from "@/lib/seo/meta";
import { buildBreadcrumbJsonLd, buildItemListJsonLd } from "@/lib/jsonld";
import { jsonLdScript } from "@/lib/seo/jsonld-script";
import { requestNonce } from "@/lib/security/nonce";
import { loadPublicVenue, filterDirectory, directoryCategories } from "@/lib/venues/public";
import { venueFaq, directionsUrl, isOpenAt, locationPath, hoursWithExceptions } from "@/lib/venues/rules";
import { venueSeo, kindLabel } from "@/lib/venues/seo";
import { cairoDateString, cairoMinutes } from "@/lib/bookings/instants";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ category?: string; zone?: string; q?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const lang = await getLang();
  const venue = await loadPublicVenue(slug);
  if (!venue) return notFoundMetadata(lang);
  const seo = venueSeo(venue, lang);
  const meta = buildMetadata({ title: seo.title, description: seo.description, path: seo.path, image: venue.coverImage, lang });
  return seo.index ? meta : { ...meta, robots: { index: false, follow: true } };
}

const DAYS_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const DAYS_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const EXCEPTION_AR: Record<string, string> = {
  CLOSED: "مقفول",
  ACCESS_SUSPENDED: "دخول الزوار موقوف",
  SPECIAL_HOURS: "مواعيد خاصة",
  BOOKINGS_PAUSED: "الحجوزات موقوفة",
};
const EXCEPTION_EN: Record<string, string> = {
  CLOSED: "Closed",
  ACCESS_SUSPENDED: "Visitor access suspended",
  SPECIAL_HOURS: "Special hours",
  BOOKINGS_PAUSED: "Bookings paused",
};

/**
 * A destination — a mall, an office complex — and the businesses in it.
 *
 * Built from the venue's own data, not from code: nothing on this page
 * names a particular operator, and nothing here is approved by anyone
 * but the venue's managers and Maw3ed's administrators. Only an ACTIVE,
 * published venue renders; its directory holds only approved tenants
 * that are themselves published (lib/venues/public.ts). Booking happens
 * on each business's own page, through the same engine as everywhere.
 */
export default async function VenuePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { category, zone, q } = await searchParams;
  const [venue, lang] = await Promise.all([loadPublicVenue(slug), getLang()]);
  if (!venue) notFound();
  const en = lang === "en";
  const t = (ar: string, e: string) => (en ? e : ar);
  const nm = (x: { nameAr: string; nameEn?: string | null }) => (en ? x.nameEn || x.nameAr : x.nameAr);

  const entries = filterDirectory(venue.directory, { category, zone, q });
  const categories = directoryCategories(venue.directory);
  const faq = venueFaq(venue, venue.policy, lang);
  const now = new Date();
  const today = cairoDateString(now);
  const dow = new Date(`${today}T12:00:00Z`).getUTCDay();
  // A dated closure or special hours today override the weekly hours.
  const openNow = venue.hours.length
    ? isOpenAt(hoursWithExceptions(venue.hours, venue.exceptions, today, dow), dow, cairoMinutes(now))
    : null;
  const path = locationPath({
    countryCode: venue.city.countryCode,
    city: venue.city,
    district: venue.district,
    compound: venue.compound,
  });
  const directions = directionsUrl({ latitude: venue.latitude, longitude: venue.longitude, label: `${venue.nameAr} ${venue.city.nameAr}` });

  const crumbs = [
    { label: t("الرئيسية", "Home"), href: "/" },
    { label: t("الأماكن", "Destinations"), href: "/venues" },
    { label: nm(venue) },
  ];
  const nonce = await requestNonce();

  return (
    <>
      <Navbar />
      <main id="main" className="pb-16 pt-20">
        <div className="container-app max-w-5xl space-y-8 text-start" dir={en ? "ltr" : "rtl"} lang={lang}>
          <Breadcrumbs items={crumbs} lang={lang} label={t("مسار الصفحة", "Breadcrumb")} />

          <header className="space-y-3">
            <p className="m-0 flex flex-wrap items-center gap-2 text-xs text-[var(--color-subtle)]">
              <Building2 size={14} aria-hidden="true" />
              {kindLabel(venue.kind, lang)}
              <span aria-hidden="true">·</span>
              {path.slice(1).map((p) => nm(p)).join(t("، ", ", "))}
            </p>
            <h1 className="m-0 text-3xl font-extrabold text-[var(--color-ink)] md:text-4xl">{nm(venue)}</h1>
            {(en ? venue.descriptionEn || venue.descriptionAr : venue.descriptionAr) && (
              <p className="m-0 max-w-3xl leading-relaxed text-[var(--color-muted)]">
                {en ? venue.descriptionEn || venue.descriptionAr : venue.descriptionAr}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {openNow !== null && (
                <span className={`badge ${openNow ? "badge-success" : "badge-warning"}`}>
                  {openNow ? t("مفتوح دلوقتي", "Open now") : t("مقفول دلوقتي", "Closed now")}
                </span>
              )}
              <a href={directions} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm gap-1.5">
                <Navigation size={14} aria-hidden="true" />
                {t("الاتجاهات", "Directions")}
              </a>
              {venue.phone && (
                <a href={`tel:${venue.phone}`} className="btn btn-ghost btn-sm gap-1.5" dir="ltr">
                  <Phone size={14} aria-hidden="true" />
                  {venue.phone}
                </a>
              )}
              {venue.website && (
                <a href={venue.website} target="_blank" rel="noopener noreferrer nofollow" className="btn btn-ghost btn-sm gap-1.5">
                  <Globe size={14} aria-hidden="true" />
                  {t("الموقع الإلكتروني", "Website")}
                </a>
              )}
            </div>
          </header>

          {venue.exceptions.length > 0 && (
            <section aria-labelledby="exc-h" className="rounded-[var(--radius-lg)] border border-[var(--color-warn-line)] bg-[var(--color-warn-soft)] p-4">
              <h2 id="exc-h" className="m-0 mb-2 text-sm font-bold text-[var(--color-warn)]">{t("تنبيهات", "Notices")}</h2>
              <ul className="m-0 list-none space-y-1 p-0 text-sm text-[var(--color-warn)]">
                {venue.exceptions.map((e, i) => (
                  <li key={i}>
                    <span className="num" dir="ltr">{e.startsOn}{e.endsOn !== e.startsOn ? ` → ${e.endsOn}` : ""}</span>
                    {" — "}
                    {(en ? EXCEPTION_EN : EXCEPTION_AR)[e.kind]}
                    {e.kind === "SPECIAL_HOURS" && e.openTime && e.closeTime ? ` (${e.openTime}–${e.closeTime})` : ""}
                    {(en ? e.noteEn || e.noteAr : e.noteAr) ? `: ${en ? e.noteEn || e.noteAr : e.noteAr}` : ""}
                    {e.kind === "CLOSED" || e.kind === "BOOKINGS_PAUSED"
                      ? t(" — الحجز الأونلاين في الأماكن هنا متوقف في الأيام دي.", " — online booking at the businesses here is paused on these days.")
                      : ""}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="dir-h" className="space-y-4">
            <h2 id="dir-h" className="m-0 text-xl font-extrabold">{t("الأماكن جوه", "Inside")}</h2>
            {venue.directory.length === 0 ? (
              <p className="m-0 rounded-[var(--radius-lg)] border border-dashed border-[var(--color-line)] p-6 text-center text-sm text-[var(--color-subtle)]">
                {t("لسه مفيش أماكن معروضة هنا.", "No businesses are listed here yet.")}
              </p>
            ) : (
              <>
                <form method="get" className="flex flex-wrap items-end gap-3" role="search">
                  <label className="min-w-[12rem] flex-1 space-y-1 text-sm">
                    <span className="font-bold">{t("دوّر", "Search")}</span>
                    <span className="relative block">
                      <Search size={15} aria-hidden="true" className="absolute start-3 top-1/2 -translate-y-1/2 text-[var(--color-subtle)]" />
                      <input name="q" defaultValue={q ?? ""} className="w-full rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] py-2 pe-3 ps-9" />
                    </span>
                  </label>
                  {categories.length > 1 && (
                    <label className="space-y-1 text-sm">
                      <span className="font-bold">{t("النوع", "Category")}</span>
                      <select name="category" defaultValue={category ?? ""} className="block rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2">
                        <option value="">{t("الكل", "All")}</option>
                        {categories.map((c) => (
                          <option key={c.slug} value={c.slug}>{nm(c)} ({c.count})</option>
                        ))}
                      </select>
                    </label>
                  )}
                  {venue.zones.length > 0 && (
                    <label className="space-y-1 text-sm">
                      <span className="font-bold">{t("الدور / المنطقة", "Floor / zone")}</span>
                      <select name="zone" defaultValue={zone ?? ""} className="block rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2">
                        <option value="">{t("الكل", "All")}</option>
                        {venue.zones.map((z) => (
                          <option key={z.id} value={z.id}>{nm(z)}</option>
                        ))}
                      </select>
                    </label>
                  )}
                  <button type="submit" className="btn btn-primary">{t("عرض", "Show")}</button>
                </form>

                {entries.length === 0 ? (
                  <p className="m-0 text-sm text-[var(--color-subtle)]">{t("مفيش نتايج للاختيار ده.", "Nothing matches these filters.")}</p>
                ) : (
                  <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
                    {entries.map((e) => (
                      <li key={e.membershipId} className="card flex flex-col gap-2 p-4">
                        <div className="flex items-start gap-3">
                          {e.logoImage ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={e.logoImage} alt="" width={44} height={44} className="h-11 w-11 shrink-0 rounded-[var(--radius-md)] object-cover" />
                          ) : (
                            <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-jade-soft)] font-bold text-[var(--color-jade)]">
                              {nm(e).charAt(0)}
                            </span>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="m-0 flex items-center gap-1 font-bold text-[var(--color-ink)]">
                              <span className="truncate">{nm(e)}</span>
                              {e.isVerified && <BadgeCheck size={14} aria-label={t("موثّق", "Verified")} className="shrink-0 text-[var(--color-jade)]" />}
                            </p>
                            <p className="m-0 text-xs text-[var(--color-subtle)]">
                              {e.category ? nm(e.category) : ""}
                              {e.zone ? ` · ${nm(e.zone)}` : ""}
                              {e.unit ? ` · ${t("وحدة", "Unit")} ${e.unit}` : ""}
                              {e.branch ? ` · ${nm(e.branch)}` : ""}
                            </p>
                          </div>
                        </div>
                        <Link href={`/company/${e.slug}${e.branch ? `?branch=${e.branch.id}` : ""}`} className="btn btn-primary btn-sm mt-auto">
                          {t("احجز", "Book")}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </section>

          <div className="grid gap-6 md:grid-cols-2">
            {venue.zones.length > 0 && (
              <section aria-labelledby="zones-h" className="card space-y-2 p-5">
                <h2 id="zones-h" className="m-0 flex items-center gap-2 text-base font-extrabold"><MapPin size={16} aria-hidden="true" />{t("الأدوار والمناطق", "Floors and zones")}</h2>
                <ul className="m-0 list-none space-y-1 p-0 text-sm">
                  {venue.zones.map((z) => (
                    <li key={z.id} className="flex justify-between gap-3">
                      <span>{nm(z)}</span>
                      <span className="text-[var(--color-subtle)]">
                        {venue.directory.filter((d) => d.zone?.id === z.id).length} {t("مكان", "places")}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {venue.hours.length > 0 && (
              <section aria-labelledby="hours-h" className="card space-y-2 p-5">
                <h2 id="hours-h" className="m-0 flex items-center gap-2 text-base font-extrabold"><Clock size={16} aria-hidden="true" />{t("مواعيد المكان", "Opening hours")}</h2>
                <ul className="m-0 list-none space-y-1 p-0 text-sm">
                  {venue.hours.map((h) => (
                    <li key={h.dayOfWeek} className="flex justify-between gap-3">
                      <span>{(en ? DAYS_EN : DAYS_AR)[h.dayOfWeek]}</span>
                      <span className="num" dir="ltr">{h.isClosed ? t("مقفول", "Closed") : `${h.openTime}–${h.closeTime}`}</span>
                    </li>
                  ))}
                </ul>
                <p className="m-0 text-xs text-[var(--color-subtle)]">
                  {t("كل مكان جوه ليه مواعيده — شوفها في صفحته.", "Each business keeps its own hours — see its page.")}
                </p>
              </section>
            )}
          </div>

          <section aria-labelledby="access-h" className="card space-y-3 p-5">
            <h2 id="access-h" className="m-0 flex items-center gap-2 text-base font-extrabold"><ShieldCheck size={16} aria-hidden="true" />{t("معلومات الزوار والدخول", "Visitor and access information")}</h2>
            {venue.policy && (en ? venue.policy.accessInstructionsEn || venue.policy.accessInstructionsAr : venue.policy.accessInstructionsAr) ? (
              <p className="m-0 whitespace-pre-line text-sm leading-relaxed">
                {en ? venue.policy.accessInstructionsEn || venue.policy.accessInstructionsAr : venue.policy.accessInstructionsAr}
              </p>
            ) : (
              <p className="m-0 text-sm text-[var(--color-subtle)]">
                {t("إدارة المكان لسه ما نشرتش تعليمات دخول.", "The venue's management has not published access instructions yet.")}
              </p>
            )}
            {venue.gates.length > 0 && (
              <div>
                <p className="m-0 mb-1 text-sm font-bold">{t("البوابات", "Entrances")}</p>
                <ul className="m-0 list-none space-y-1 p-0 text-sm">
                  {venue.gates.map((g) => (
                    <li key={g.id} className="flex flex-wrap items-center gap-2">
                      <span>{nm(g)}</span>
                      <span className="text-xs text-[var(--color-subtle)]">
                        {g.kind === "VEHICLE" ? t("سيارات", "vehicles") : g.kind === "PEDESTRIAN" ? t("مشاة", "pedestrians") : t("سيارات ومشاة", "vehicles and pedestrians")}
                      </span>
                      {g.latitude != null && g.longitude != null && (
                        <a className="text-xs text-[var(--color-jade)] underline" target="_blank" rel="noopener noreferrer" href={directionsUrl({ latitude: g.latitude, longitude: g.longitude, label: g.nameAr })}>
                          {t("اتجاهات", "directions")}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="m-0 flex items-start gap-2 text-xs text-[var(--color-subtle)]">
              <Info size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
              {t(
                "المعلومات دي من إدارة المكان. موعد مش بيصدر تصاريح دخول، والحجز لوحده مش تصريح دخول.",
                "This information comes from the venue's management. Maw3ed does not issue entry passes, and a booking is not an entry pass on its own.",
              )}
            </p>
          </section>

          <section aria-labelledby="faq-h" className="space-y-3">
            <h2 id="faq-h" className="m-0 text-xl font-extrabold">{t("أسئلة شائعة", "Frequently asked questions")}</h2>
            <div className="space-y-2">
              {faq.map((f, i) => (
                <details key={i} className="card p-4">
                  <summary className="cursor-pointer font-bold">{f.q}</summary>
                  <p className="m-0 mt-2 text-sm leading-relaxed text-[var(--color-muted)]">{f.a}</p>
                </details>
              ))}
            </div>
          </section>
        </div>
      </main>
      <Footer />
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{
          __html: jsonLdScript(buildBreadcrumbJsonLd([
            { name: t("الرئيسية", "Home"), path: "/" },
            { name: t("الأماكن", "Destinations"), path: "/venues" },
            { name: nm(venue) },
          ])),
        }}
      />
      {venue.directory.length > 0 && (
        <script
          type="application/ld+json"
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: jsonLdScript(buildItemListJsonLd(venue.directory.map((d) => ({ slug: d.slug, name: nm(d) })))) }}
        />
      )}
    </>
  );
}
