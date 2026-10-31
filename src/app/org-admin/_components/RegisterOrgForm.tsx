"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";

const field = "w-full rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-sm";

/**
 * Registers a parent organization: a mall, compound, commercial
 * building, business group, franchise or company. It is created
 * pending Maw3ed's review; the registrant becomes its owner.
 */
export default function RegisterOrgForm() {
  const { lang } = useLanguage();
  const en = lang === "en";
  const t = (ar: string, e: string) => (en ? e : ar);
  const router = useRouter();
  const [v, setV] = useState({ nameAr: "", nameEn: "", slug: "", kind: "MALL" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/organizations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(v),
    }).catch(() => null);
    const json = ((await res?.json().catch(() => ({}))) ?? {}) as { error?: string; organization?: { id: string } };
    if (res?.ok && json.organization) {
      router.push(`/org-admin/${json.organization.id}`);
      router.refresh();
    } else {
      setError(json.error ?? t("حصلت مشكلة.", "Something went wrong."));
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="card space-y-3 p-5" aria-labelledby="reg-h">
      <h2 id="reg-h" className="m-0 text-base font-extrabold">{t("سجّل جهة جديدة", "Register an organization")}</h2>
      <p className="m-0 text-xs text-[var(--color-subtle)]">
        {t(
          "مول، كمبوند، مبنى تجاري، مجموعة مطاعم أو عيادات، فرنشايز… موعد بيراجع التسجيل قبل ما الجهة تدعو أنشطة أو تنشر صفحتها.",
          "A mall, compound, commercial building, restaurant or clinic group, franchise… Maw3ed reviews the registration before the organization can invite businesses or publish its page.",
        )}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-bold">{t("الاسم بالعربي", "Name (Arabic)")}</span>
          <input className={field} value={v.nameAr} onChange={(e) => setV({ ...v, nameAr: e.target.value })} required minLength={2} maxLength={120} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-bold">{t("الاسم بالإنجليزي", "Name (English)")}</span>
          <input className={field} value={v.nameEn} onChange={(e) => setV({ ...v, nameEn: e.target.value })} dir="ltr" maxLength={120} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-bold">{t("الرابط", "Link")}</span>
          <span className="flex items-center gap-1" dir="ltr">
            <span className="text-xs text-[var(--color-subtle)]">maw3ed.net/groups/</span>
            <input className={field} value={v.slug} onChange={(e) => setV({ ...v, slug: e.target.value })} required pattern="[a-z0-9]+(-[a-z0-9]+)*" minLength={3} maxLength={60} />
          </span>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-bold">{t("النوع", "Type")}</span>
          <select className={field} value={v.kind} onChange={(e) => setV({ ...v, kind: e.target.value })}>
            <option value="MALL">{t("مول", "Mall")}</option>
            <option value="COMPOUND">{t("كمبوند", "Compound")}</option>
            <option value="BUSINESS_GROUP">{t("مجموعة أعمال", "Business group")}</option>
            <option value="FRANCHISE">{t("فرنشايز", "Franchise")}</option>
            <option value="COMMERCIAL_BUILDING">{t("مبنى تجاري", "Commercial building")}</option>
            <option value="OTHER">{t("غير ذلك", "Other")}</option>
          </select>
        </label>
      </div>
      <button type="submit" className="btn btn-primary" disabled={busy}>{t("سجّل", "Register")}</button>
      <p role="status" className="m-0 min-h-5 text-sm text-[var(--color-danger)]">{error}</p>
    </form>
  );
}
