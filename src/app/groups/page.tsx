import type { Metadata } from "next";
import { Building2 } from "lucide-react";
import Link from "@/components/shared/LocaleLink";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { getLang } from "@/lib/lang-server";
import { buildMetadata } from "@/lib/seo/meta";
import { listPublicOrganizations, type OrgFamily } from "@/lib/organizations/public";
import { orgKindLabel } from "@/lib/organizations/seo";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** ?q= (a name, up to 100 characters) and ?type=destinations|groups. */
function readFilter(sp: Record<string, string | string[] | undefined>): { q: string; family?: OrgFamily } {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const q = one(sp.q).trim().slice(0, 100);
  const type = one(sp.type);
  return { q, family: type === "destinations" || type === "groups" ? type : undefined };
}

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const lang = await getLang();
  const filter = readFilter(await searchParams);
  const orgs = await listPublicOrganizations().catch(() => []);
  const meta =
    lang === "en"
      ? buildMetadata({ title: "Malls, groups and destinations", description: "Organizations whose places take online bookings on Maw3ed.", path: "/groups", lang })
      : buildMetadata({ title: "المولات والمجموعات والجهات", description: "جهات أماكنها بتستقبل حجوزات أونلاين على موعد.", path: "/groups" });
  // A searched or narrowed view keeps the plain index as its canonical
  // (meta above) and stays out of the index itself.
  const indexable = !filter.q && !filter.family && orgs.some((o) => o.businesses > 0);
  return indexable ? meta : { ...meta, robots: { index: false, follow: true } };
}

export default async function GroupsIndex({ searchParams }: { searchParams: SearchParams }) {
  const filter = readFilter(await searchParams);
  const [all, lang] = await Promise.all([listPublicOrganizations(filter), getLang()]);
  // An organization with nothing in its directory is a dead end for a
  // customer (its own page is noindex for the same reason).
  const orgs = all.filter((o) => o.businesses > 0);
  const en = lang === "en";
  const filtered = Boolean(filter.q || filter.family);
  const chip = (family: OrgFamily | undefined, label: string) => {
    const params = new URLSearchParams();
    if (filter.q) params.set("q", filter.q);
    if (family) params.set("type", family);
    const href = params.size ? `/groups?${params}` : "/groups";
    const on = filter.family === family;
    return (
      <Link key={family ?? "all"} href={href} aria-current={on ? "page" : undefined} className={`chip ${on ? "chip-jade" : ""}`}>
        {label}
      </Link>
    );
  };
  return (
    <>
      <Navbar />
      <main id="main" className="pb-16 pt-24">
        <div className="container-app max-w-5xl space-y-6 text-start" dir={en ? "ltr" : "rtl"} lang={lang}>
          <header className="space-y-1">
            <h1 className="m-0 text-3xl font-extrabold text-[var(--color-ink)]">{en ? "Malls, groups and destinations" : "المولات والمجموعات والجهات"}</h1>
            <p className="m-0 text-[var(--color-muted)]">
              {en ? "Find the organization, then book at any of its places." : "لاقي الجهة، واحجز في أي مكان من أماكنها."}
            </p>
          </header>
          <form action={en ? "/en/groups" : "/groups"} method="get" role="search" className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label htmlFor="groups-q" className="sr-only">{en ? "Search by name" : "ابحث بالاسم"}</label>
            <input
              id="groups-q"
              name="q"
              type="search"
              defaultValue={filter.q}
              maxLength={100}
              placeholder={en ? "Search malls and groups by name" : "ابحث عن مول أو مجموعة بالاسم"}
              className="input h-11 flex-1"
            />
            {filter.family && <input type="hidden" name="type" value={filter.family} />}
            <button type="submit" className="btn btn-primary h-11">{en ? "Search" : "بحث"}</button>
          </form>
          <nav aria-label={en ? "Type" : "النوع"} className="flex flex-wrap gap-2">
            {chip(undefined, en ? "All" : "الكل")}
            {chip("destinations", en ? "Malls and destinations" : "مولات ووجهات")}
            {chip("groups", en ? "Business groups" : "مجموعات أعمال")}
          </nav>
          {orgs.length === 0 ? (
            <p className="m-0 rounded-[var(--radius-lg)] border border-dashed border-[var(--color-line)] p-6 text-center text-sm text-[var(--color-subtle)]">
              {filtered
                ? en ? "Nothing matches that. Try another name, or browse all." : "مفيش نتيجة. جرّب اسم تاني، أو اعرض الكل."
                : en ? "No organizations are listed yet." : "لسه مفيش جهات معروضة."}
            </p>
          ) : (
            <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2">
              {orgs.map((o) => (
                <li key={o.slug}>
                  <Link href={`/groups/${o.slug}`} className="card block h-full p-5 hover:border-[var(--color-jade)]">
                    <p className="m-0 flex items-center gap-2 text-xs text-[var(--color-subtle)]">
                      <Building2 size={14} aria-hidden="true" />
                      {orgKindLabel(o.kind, lang)}
                      {o.city ? ` · ${en ? o.city.nameEn || o.city.nameAr : o.city.nameAr}` : ""}
                    </p>
                    <p className="m-0 mt-1 text-lg font-bold text-[var(--color-ink)]">{en ? o.nameEn || o.nameAr : o.nameAr}</p>
                    <p className="m-0 mt-1 text-sm text-[var(--color-muted)]">
                      {en ? `${o.businesses} place(s) to book` : `${o.businesses} مكان تقدر تحجز فيه`}
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
