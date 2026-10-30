import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "@/components/shared/LocaleLink";
import { Building2, Landmark } from "lucide-react";
import { getLang } from "@/lib/lang-server";
import { loadVenueCaller, venuesFor } from "@/lib/venues/guard";
import { organizationsFor } from "@/lib/organizations/guard";
import RegisterOrgForm from "./_components/RegisterOrgForm";

export const metadata: Metadata = { title: "إدارة الجهات والأماكن", robots: { index: false, follow: false } };

/**
 * The console's front door: the organizations and venues this person
 * runs, and the way to register a new organization. Any signed-in
 * account may open it — registering is how an organization starts.
 */
export default async function OrgAdminIndex() {
  const caller = await loadVenueCaller();
  if (!caller) redirect("/login?next=/org-admin");
  const [organizations, venues, lang] = await Promise.all([organizationsFor(caller), venuesFor(caller), getLang()]);
  const en = lang === "en";
  const t = (ar: string, e: string) => (en ? e : ar);
  const STATUS: Record<string, string> = {
    PENDING: t("قيد مراجعة موعد", "Under Maw3ed review"),
    APPROVED: t("معتمدة", "Approved"),
    REJECTED: t("مرفوضة", "Rejected"),
    SUSPENDED: t("موقوفة", "Suspended"),
  };

  return (
    <main id="main" className="mx-auto max-w-3xl space-y-6 p-5 md:p-8" dir={en ? "ltr" : "rtl"}>
      <h1 className="m-0 text-2xl font-black">{t("الجهات والأماكن اللي بتديرها", "Organizations and venues you manage")}</h1>

      <section aria-labelledby="orgs-h" className="space-y-2">
        <h2 id="orgs-h" className="m-0 text-base font-extrabold">{t("الجهات", "Organizations")}</h2>
        {organizations.length === 0 ? (
          <p className="m-0 text-sm text-[var(--color-subtle)]">{t("لسه مفيش.", "None yet.")}</p>
        ) : (
          <ul className="m-0 list-none space-y-2 p-0">
            {organizations.map((o) => (
              <li key={o.id}>
                <Link href={`/org-admin/${o.id}`} className="card flex items-center justify-between gap-3 p-4 hover:border-[var(--color-jade)]">
                  <span className="flex items-center gap-2 font-bold">
                    <Building2 size={16} aria-hidden="true" />
                    {en ? o.nameEn || o.nameAr : o.nameAr}
                  </span>
                  <span className="text-xs text-[var(--color-subtle)]">
                    {STATUS[o.status] ?? o.status}
                    {o.isPublished ? t(" · منشورة", " · public") : t(" · مش منشورة", " · not public")}
                    {" · "}{o._count.associations} {t("نشاط", "businesses")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {venues.length > 0 && (
        <section aria-labelledby="v-h" className="space-y-2">
          <h2 id="v-h" className="m-0 text-base font-extrabold">{t("الأماكن", "Venues")}</h2>
          <ul className="m-0 list-none space-y-2 p-0">
            {venues.map((v) => (
              <li key={v.id}>
                <Link href={`/venue-admin/${v.id}`} className="card flex items-center justify-between gap-3 p-4 hover:border-[var(--color-jade)]">
                  <span className="flex items-center gap-2 font-bold">
                    <Landmark size={16} aria-hidden="true" />
                    {en ? v.nameEn || v.nameAr : v.nameAr}
                  </span>
                  <span className="text-xs text-[var(--color-subtle)]">
                    {v.status}
                    {v.isPublished ? t(" · منشور", " · public") : t(" · مش منشور", " · not public")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <RegisterOrgForm />

      <p className="m-0 text-xs text-[var(--color-subtle)]">
        {en ? "Run a business of your own? " : "عندك نشاط خاص بيك؟ "}
        <Link href="/onboarding?create=1" className="text-[var(--color-jade)] underline">
          {en ? "Create its page" : "اعمل صفحته"}
        </Link>
      </p>
    </main>
  );
}
