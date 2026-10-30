import type { Metadata } from "next";
import { Building2 } from "lucide-react";
import Link from "@/components/shared/LocaleLink";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { getLang } from "@/lib/lang-server";
import { buildMetadata } from "@/lib/seo/meta";
import { listPublicOrganizations } from "@/lib/organizations/public";
import { orgKindLabel } from "@/lib/organizations/seo";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLang();
  const orgs = await listPublicOrganizations().catch(() => []);
  const meta =
    lang === "en"
      ? buildMetadata({ title: "Malls, groups and destinations", description: "Organizations whose places take online bookings on Maw3ed.", path: "/groups", lang })
      : buildMetadata({ title: "المولات والمجموعات والجهات", description: "جهات أماكنها بتستقبل حجوزات أونلاين على موعد.", path: "/groups" });
  return orgs.some((o) => o.businesses > 0) ? meta : { ...meta, robots: { index: false, follow: true } };
}

export default async function GroupsIndex() {
  const [orgs, lang] = await Promise.all([listPublicOrganizations(), getLang()]);
  const en = lang === "en";
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
          {orgs.length === 0 ? (
            <p className="m-0 rounded-[var(--radius-lg)] border border-dashed border-[var(--color-line)] p-6 text-center text-sm text-[var(--color-subtle)]">
              {en ? "No organizations are listed yet." : "لسه مفيش جهات معروضة."}
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
