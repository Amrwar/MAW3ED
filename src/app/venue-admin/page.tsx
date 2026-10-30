import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "@/components/shared/LocaleLink";
import { Building2 } from "lucide-react";
import { getLang } from "@/lib/lang-server";
import { loadVenueCaller, venuesFor } from "@/lib/venues/guard";

export const metadata: Metadata = { title: "إدارة الأماكن", robots: { index: false, follow: false } };

/**
 * The venue console's front door: the venues this person may manage.
 * Nobody without a venue role or platform authority sees that it exists.
 */
export default async function VenueAdminIndex() {
  const caller = await loadVenueCaller();
  if (!caller) redirect("/login?next=/venue-admin");
  const venues = await venuesFor(caller);
  if (!caller.platform && venues.length === 0) notFound();
  const en = (await getLang()) === "en";

  return (
    <main id="main" className="mx-auto max-w-3xl space-y-5 p-5 md:p-8" dir={en ? "ltr" : "rtl"}>
      <h1 className="m-0 text-2xl font-black">{en ? "Venues you manage" : "الأماكن اللي بتديرها"}</h1>
      {venues.length === 0 ? (
        <p className="m-0 text-sm text-[var(--color-subtle)]">{en ? "No venues yet." : "لسه مفيش أماكن."}</p>
      ) : (
        <ul className="m-0 list-none space-y-2 p-0">
          {venues.map((v) => (
            <li key={v.id}>
              <Link href={`/venue-admin/${v.id}`} className="card flex items-center justify-between gap-3 p-4 hover:border-[var(--color-jade)]">
                <span className="flex items-center gap-2 font-bold">
                  <Building2 size={16} aria-hidden="true" />
                  {en ? v.nameEn || v.nameAr : v.nameAr}
                </span>
                <span className="text-xs text-[var(--color-subtle)]">
                  {v.status}
                  {v.isPublished ? (en ? " · public" : " · منشور") : en ? " · not public" : " · مش منشور"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {!caller.platform && (
        <p className="m-0 text-xs text-[var(--color-subtle)]">
          {en ? "Run a business of your own? " : "عندك نشاط خاص بيك؟ "}
          <Link href="/onboarding?create=1" className="text-[var(--color-jade)] underline">
            {en ? "Create its page" : "اعمل صفحته"}
          </Link>
        </p>
      )}
    </main>
  );
}
