import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { Building2, MapPin, Phone, Globe, Navigation, BadgeCheck, Search, Mail, Link2 } from "lucide-react";
import Link from "@/components/shared/LocaleLink";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Breadcrumbs from "@/components/shared/Breadcrumbs";
import RecordView from "@/features/company/RecordView";
import { getLang } from "@/lib/lang-server";
import { buildMetadata, notFoundMetadata } from "@/lib/seo/meta";
import { buildBreadcrumbJsonLd, buildItemListJsonLd } from "@/lib/jsonld";
import { jsonLdScript } from "@/lib/seo/jsonld-script";
import { requestNonce } from "@/lib/security/nonce";
import { resolveSource } from "@/lib/attribution/source";
import { OWN_HOSTS } from "@/lib/attribution/hosts";
import { loadPublicOrganization, pageDirectory, orgDirectoryCategories, directorySections } from "@/lib/organizations/public";
import { orgSeo, orgKindLabel } from "@/lib/organizations/seo";
import { directionsUrl } from "@/lib/venues/rules";
import { cairoDateString } from "@/lib/bookings/instants";
import { todaysHours } from "@/lib/organizations/hours";
import SharePage from "@/components/shared/SharePage";
import { kindLabel } from "@/lib/venues/seo";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string; category?: string; section?: string; page?: string; src?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const lang = await getLang();
  const org = await loadPublicOrganization(slug);
  if (!org) return notFoundMetadata(lang);
  const seo = orgSeo(org, lang);
  const meta = buildMetadata({ title: seo.title, description: seo.description, path: seo.path, image: org.coverImage ?? org.logoImage, lang });
  return seo.index ? meta : { ...meta, robots: { index: false, follow: true } };
}

/**
 * An organization's public directory: a mall, a compound, a group of
 * brands. Only an APPROVED, published organization renders; its
 * directory holds only approved associations of businesses whose own
 * pages are published (lib/organizations/public.ts). Booking happens on
 * each business's page, through the one existing engine; links carry
 * ?org= so the organization sees what its page brings in — as counts.
 */
export default async function GroupPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const [org, lang] = await Promise.all([loadPublicOrganization(slug), getLang()]);
  if (!org) notFound();
  const en = lang === "en";
  const t = (ar: string, e: string) => (en ? e : ar);
  const nm = (x: { nameAr: string; nameEn?: string | null }) => (en ? x.nameEn || x.nameAr : x.nameAr);

  const paged = pageDirectory(org.directory, {
    q: sp.q,
    category: sp.category,
    section: sp.section,
    page: Number(sp.page) || 1,
  });
  const categories = orgDirectoryCategories(org.directory);
  const sections = directorySections(org.directory);
  const referrer = (await headers()).get("referer");
  const source = resolveSource({ src: sp.src ?? null, referrer, ownHosts: OWN_HOSTS });
  const nonce = await requestNonce();
  const pageHref = (p: number) => {
    const q = new URLSearchParams();
    if (sp.q) q.set("q", sp.q);
    if (sp.category) q.set("category", sp.category);
    if (sp.section) q.set("section", sp.section);
    if (p > 1) q.set("page", String(p));
    const qs = q.toString();
    return `/groups/${org.slug}${qs ? `?${qs}` : ""}`;
  };

  return (
    <>
      <Navbar />
      <main id="main" className="pb-16 pt-20">
        <div className="container-app max-w-5xl space-y-8 text-start" dir={en ? "ltr" : "rtl"} lang={lang}>
          <Breadcrumbs
            items={[{ label: t("الرئيسية", "Home"), href: "/" }, { label: t("الجهات", "Organizations"), href: "/groups" }, { label: nm(org) }]}
            lang={lang}
            label={t("مسار الصفحة", "Breadcrumb")}
          />

          <header className="space-y-3">
            <div className="flex items-start gap-4">
              {org.logoImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={org.logoImage} alt="" width={64} height={64} className="h-16 w-16 shrink-0 rounded-[var(--radius-lg)] object-cover" />
              ) : (
                <span aria-hidden="true" className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--color-jade-soft)] text-xl font-bold text-[var(--color-jade)]">
                  {nm(org).charAt(0)}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="m-0 flex flex-wrap items-center gap-2 text-xs text-[var(--color-subtle)]">
                  <Building2 size={14} aria-hidden="true" />
                  {orgKindLabel(org.kind, lang)}
                  {org.city ? <span>· {nm(org.city)}</span> : null}
                </p>
                <h1 className="m-0 text-3xl font-extrabold text-[var(--color-ink)] md:text-4xl">{nm(org)}</h1>
              </div>
            </div>
            {(en ? org.descriptionEn || org.descriptionAr : org.descriptionAr) && (
              <p className="m-0 max-w-3xl leading-relaxed text-[var(--color-muted)]">{en ? org.descriptionEn || org.descriptionAr : org.descriptionAr}</p>
            )}
            <div className="flex flex-wrap gap-2">
              {org.address && (
                <a href={directionsUrl({ latitude: null, longitude: null, label: [org.address, org.city?.nameAr].filter(Boolean).join("، ") })} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm gap-1.5">
                  <Navigation size={14} aria-hidden="true" />
                  {t("الاتجاهات", "Directions")}
                </a>
              )}
              {org.phone && (
                <a href={`tel:${org.phone}`} className="btn btn-ghost btn-sm gap-1.5" dir="ltr">
                  <Phone size={14} aria-hidden="true" />
                  {org.phone}
                </a>
              )}
              {org.email && (
                <a href={`mailto:${org.email}`} className="btn btn-ghost btn-sm gap-1.5" dir="ltr">
                  <Mail size={14} aria-hidden="true" />
                  {org.email}
                </a>
              )}
              {org.website && (
                <a href={org.website} target="_blank" rel="noopener noreferrer nofollow" className="btn btn-ghost btn-sm gap-1.5">
                  <Globe size={14} aria-hidden="true" />
                  {t("الموقع الإلكتروني", "Website")}
                </a>
              )}
              {org.instagram && (
                <a href={`https://instagram.com/${org.instagram.replace(/^@/, "")}`} target="_blank" rel="noopener noreferrer nofollow" className="btn btn-ghost btn-sm gap-1.5">
                  <Link2 size={14} aria-hidden="true" />
                  Instagram
                </a>
              )}
              {org.facebook && (
                <a href={`https://facebook.com/${org.facebook.replace(/^@/, "")}`} target="_blank" rel="noopener noreferrer nofollow" className="btn btn-ghost btn-sm gap-1.5">
                  <Link2 size={14} aria-hidden="true" />
                  Facebook
                </a>
              )}
              <SharePage title={nm(org)} label={t("مشاركة", "Share")} copied={t("اتنسخ الرابط", "Link copied")} />
            </div>
          </header>

          {org.parent && (
            <p className="m-0 text-sm text-[var(--color-subtle)]">
              {t("تابعة لـ ", "Part of ")}
              <Link href={`/groups/${org.parent.slug}`} className="font-bold text-[var(--color-jade)] underline">{nm(org.parent)}</Link>
            </p>
          )}

          {org.children.length > 0 && (
            <section aria-labelledby="sub-h" className="space-y-3">
              <h2 id="sub-h" className="m-0 text-xl font-extrabold">{t("الجهات التابعة", "Organizations within")}</h2>
              <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                {org.children.map((c) => (
                  <li key={c.slug}>
                    <Link href={`/groups/${c.slug}`} className="btn btn-outline btn-sm">{nm(c)}</Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {org.venues.length > 0 && (
            <section aria-labelledby="loc-h" className="space-y-3">
              <h2 id="loc-h" className="m-0 text-xl font-extrabold">{t("المواقع", "Locations")}</h2>
              <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2">
                {org.venues.map((v) => {
                  const today = todaysHours(v.hours, cairoDateString());
                  // Directions only from coordinates the venue actually has;
                  // a guessed address search would send people astray.
                  const hasLocation = v.latitude != null && v.longitude != null;
                  return (
                    <li key={v.slug} className="card flex h-full flex-col gap-1 p-4">
                      <p className="m-0 flex items-center gap-2 text-xs text-[var(--color-subtle)]">
                        <MapPin size={13} aria-hidden="true" />
                        {kindLabel(v.kind, lang)} · {nm(v.city)}
                      </p>
                      <Link href={`/venues/${v.slug}`} className="font-bold text-[var(--color-ink)] hover:text-[var(--color-jade)]">{nm(v)}</Link>
                      <p className="m-0 text-xs text-[var(--color-subtle)]">
                        {v._count.memberships} {t("مكان", "places")}
                        {v.address ? ` · ${v.address}` : ""}
                      </p>
                      {today && (
                        <p className="m-0 text-xs">
                          <span className="font-bold">{t("النهارده: ", "Today: ")}</span>
                          {today.closed ? t("مقفول", "Closed") : <span dir="ltr" className="num">{today.open}–{today.close}</span>}
                        </p>
                      )}
                      {hasLocation && (
                        <a
                          href={directionsUrl({ latitude: v.latitude, longitude: v.longitude, label: nm(v) })}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-flex w-fit items-center gap-1.5 text-xs font-bold text-[var(--color-jade)] underline"
                        >
                          <Navigation size={13} aria-hidden="true" />
                          {t("الاتجاهات", "Directions")}
                        </a>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <section aria-labelledby="dir-h" className="space-y-4">
            <h2 id="dir-h" className="m-0 text-xl font-extrabold">{t("الأماكن", "Places")}</h2>
            {org.directory.length === 0 ? (
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
                      <input name="q" defaultValue={sp.q ?? ""} className="w-full rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] py-2 pe-3 ps-9" />
                    </span>
                  </label>
                  {categories.length > 1 && (
                    <label className="space-y-1 text-sm">
                      <span className="font-bold">{t("النوع", "Category")}</span>
                      <select name="category" defaultValue={sp.category ?? ""} className="block rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2">
                        <option value="">{t("الكل", "All")}</option>
                        {categories.map((c) => (
                          <option key={c.slug} value={c.slug}>{nm(c)} ({c.count})</option>
                        ))}
                      </select>
                    </label>
                  )}
                  {sections.length > 0 && (
                    <label className="space-y-1 text-sm">
                      <span className="font-bold">{t("القسم", "Section")}</span>
                      <select name="section" defaultValue={sp.section ?? ""} className="block rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2">
                        <option value="">{t("الكل", "All")}</option>
                        {sections.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </label>
                  )}
                  <button type="submit" className="btn btn-primary">{t("عرض", "Show")}</button>
                </form>

                {paged.entries.length === 0 ? (
                  <p className="m-0 text-sm text-[var(--color-subtle)]">{t("مفيش نتايج للاختيار ده.", "Nothing matches these filters.")}</p>
                ) : (
                  <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
                    {paged.entries.map((e) => (
                      <li key={e.associationId} className="card flex flex-col gap-2 p-4">
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
                              {e.section ? ` · ${e.section}` : ""}
                              {e.branch ? ` · ${nm(e.branch)}` : e.city ? ` · ${nm(e.city)}` : ""}
                            </p>
                            {e.ratingCount > 0 && (
                              <p className="m-0 text-xs text-[var(--color-subtle)]">
                                ★ {e.ratingAvg.toFixed(1)} ({e.ratingCount})
                              </p>
                            )}
                          </div>
                        </div>
                        <Link
                          href={`/company/${e.slug}?org=${org.slug}${e.branch ? `&branch=${e.branch.id}` : ""}`}
                          className="btn btn-primary btn-sm mt-auto"
                        >
                          {t("احجز", "Book")}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}

                {paged.pages > 1 && (
                  <nav aria-label={t("صفحات", "Pages")} className="flex flex-wrap items-center justify-center gap-2 text-sm">
                    {Array.from({ length: paged.pages }, (_, i) => i + 1).map((p) => (
                      <Link
                        key={p}
                        href={pageHref(p)}
                        aria-current={p === paged.page ? "page" : undefined}
                        className={`num rounded-[var(--radius-sm)] px-3 py-1.5 ${p === paged.page ? "bg-[var(--color-jade)] font-bold text-white" : "border border-[var(--color-line)] hover:border-[var(--color-jade)]"}`}
                      >
                        {p}
                      </Link>
                    ))}
                  </nav>
                )}
              </>
            )}
          </section>
        </div>
      </main>
      <Footer />
      <RecordView slug={org.slug} source={source} endpoint={`/api/public/groups/${encodeURIComponent(org.slug)}/view`} />
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{
          __html: jsonLdScript(
            buildBreadcrumbJsonLd([
              { name: t("الرئيسية", "Home"), path: "/" },
              { name: t("الجهات", "Organizations"), path: "/groups" },
              { name: nm(org) },
            ]),
          ),
        }}
      />
      {org.directory.length > 0 && (
        <script
          type="application/ld+json"
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: jsonLdScript(buildItemListJsonLd(org.directory.map((d) => ({ slug: d.slug, name: nm(d) })))) }}
        />
      )}
    </>
  );
}
