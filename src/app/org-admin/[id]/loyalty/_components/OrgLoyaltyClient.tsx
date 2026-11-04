"use client";

import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import Link from "@/components/shared/LocaleLink";
import Alert from "@/components/ui/Alert";
import LoyaltyRulesForm, { type LoyaltyRules } from "@/components/dashboard/LoyaltyRulesForm";
import { Field, INPUT, Stat, StatusChip, api, poundsToCents, useLoad, useSay } from "@/components/dashboard/kit";
import { formatCents } from "@/lib/payments/money";
import { dateShort, num } from "@/lib/fmt";

interface LoyaltyData {
  program: (LoyaltyRules & {
    id: string;
    updatedAt: string;
    participations: { businessId: string; acceptedAt: string | null; leftAt: string | null; business: { nameAr: string } }[];
  }) | null;
  members: number;
  outstandingPoints: number;
}
interface Promotion {
  id: string;
  nameAr: string;
  nameEn: string | null;
  kind: "PERCENT" | "FIXED";
  value: number;
  startsAt: string | null;
  endsAt: string | null;
  brands: { name: string; on: boolean }[];
}
interface PackagesReport {
  businesses: { businessId: string; name: string; packagesSold: number; sessionsSold: number; sessionsUsed: number; activePackages: number; activeMemberships: number }[];
}

export default function OrgLoyaltyClient({
  organizationId,
  name,
  canEdit,
}: {
  organizationId: string;
  name: { ar: string; en: string | null };
  canEdit: boolean;
}) {
  const { lang, say } = useSay();
  const base = `/api/organizations/${organizationId}`;

  return (
    <main id="main" className="mx-auto max-w-5xl space-y-6 p-5 md:p-8" dir={lang === "en" ? "ltr" : "rtl"}>
      <header className="space-y-1">
        <Link href={`/org-admin/${organizationId}`} className="text-xs text-[var(--color-jade)] underline">
          {lang === "en" && name.en ? name.en : name.ar}
        </Link>
        <h1 className="m-0 text-2xl font-black">{say("النقاط والعروض", "Loyalty & promotions")}</h1>
      </header>

      <Alert tone="info">
        {say(
          "البرنامج والعروض هنا بتتبعت بس للأنشطة اللي الجهة بتملكها، وصاحب كل نشاط هو اللي بيوافق يشترك من لوحة التحكم بتاعته. الأنشطة المستضافة أو اللي الجهة بتديرها لحساب حد تاني مش بتدخل أبدًا.",
          "The program and promotions here go only to brands the organization OWNS, and each brand's owner accepts from their own dashboard. Hosted or managed businesses are never included.",
        )}
      </Alert>

      <LoyaltySection base={base} canEdit={canEdit} />
      <PromotionsSection base={base} canEdit={canEdit} />
      <PackagesSection base={base} />
    </main>
  );
}

function LoyaltySection({ base, canEdit }: { base: string; canEdit: boolean }) {
  const { lang, say } = useSay();
  const { data, error, loading, reload } = useLoad<LoyaltyData>(`${base}/loyalty`);
  const [invited, setInvited] = useState<number | null>(null);

  return (
    <section aria-labelledby="ol-h" className="space-y-3">
      <h2 id="ol-h" className="m-0 text-base font-extrabold">{say("برنامج النقاط المشترك", "Shared points program")}</h2>
      {loading && <Spinner />}
      {error && <Alert tone="danger">{error}</Alert>}
      {data && (
        <>
          {data.program && (
            <div className="grid grid-cols-2 gap-3">
              <Stat label={say("عملاء عندهم نقاط", "Customers with points")} value={num(data.members, lang)} />
              <Stat label={say("نقاط لسه متصرفتش", "Outstanding points")} value={num(data.outstandingPoints, lang)} />
            </div>
          )}
          {canEdit ? (
            <LoyaltyRulesForm
              key={data.program?.updatedAt ?? "new"}
              idPrefix="olr"
              endpoint={`${base}/loyalty`}
              initial={data.program}
              onSaved={(json) => {
                setInvited(typeof json.invited === "number" ? json.invited : null);
                reload();
              }}
            />
          ) : (
            !data.program && <p className="m-0 text-sm text-[var(--color-subtle)]">{say("لسه مفيش برنامج.", "No program yet.")}</p>
          )}
          {invited != null && invited > 0 && (
            <Alert tone="success">{say(`اتبعتت دعوة لـ ${invited} نشاط.`, `${invited} brands invited.`)}</Alert>
          )}
          {data.program && data.program.participations.length > 0 && (
            <div className="card overflow-x-auto p-0">
              <table className="w-full min-w-[24rem] text-sm">
                <caption className="p-3 text-start font-bold">{say("الأنشطة", "Brands")}</caption>
                <tbody>
                  {data.program.participations.map((p) => (
                    <tr key={p.businessId} className="border-t border-[var(--color-line)]">
                      <td className="p-3">{p.business.nameAr}</td>
                      <td className="p-3">
                        {p.leftAt ? <StatusChip tone="muted">{say("خرج", "Left")}</StatusChip>
                          : p.acceptedAt ? <StatusChip tone="jade">{say("مشترك", "Joined")}</StatusChip>
                          : <StatusChip tone="warn">{say("مستني موافقة صاحب النشاط", "Awaiting the owner")}</StatusChip>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function PromotionsSection({ base, canEdit }: { base: string; canEdit: boolean }) {
  const { lang, say } = useSay();
  const { data, error, loading, reload } = useLoad<{ promotions: Promotion[] }>(`${base}/promotions`);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ nameAr: "", nameEn: "", kind: "PERCENT" as "PERCENT" | "FIXED", value: "", startsAt: "", endsAt: "" });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [offered, setOffered] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = f.kind === "FIXED" ? poundsToCents(f.value) : Number(f.value);
    if (!value || value < 1 || !Number.isInteger(value)) {
      setFormError(say("اكتب القيمة", "Enter the value"));
      return;
    }
    setBusy(true);
    setFormError(null);
    const r = await api<{ offered: unknown }>(`${base}/promotions`, "POST", {
      nameAr: f.nameAr.trim(),
      nameEn: f.nameEn.trim() || null,
      kind: f.kind,
      value,
      startsAt: f.startsAt ? new Date(f.startsAt).toISOString() : null,
      endsAt: f.endsAt ? new Date(`${f.endsAt}T23:59:59`).toISOString() : null,
    });
    setBusy(false);
    if (!r.ok) {
      setFormError(r.data.error ?? say("تعذّر الحفظ", "Could not save"));
      return;
    }
    setOffered(typeof r.data.offered === "number" ? say(`اتعرض على ${r.data.offered} نشاط — كل صاحب نشاط بيشغّله بنفسه.`, `Offered to ${r.data.offered} brands — each owner switches it on.`) : say("اتعمل.", "Created."));
    setOpen(false);
    setF({ nameAr: "", nameEn: "", kind: "PERCENT", value: "", startsAt: "", endsAt: "" });
    reload();
  }

  return (
    <section aria-labelledby="op-h" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="op-h" className="m-0 text-base font-extrabold">{say("العروض المشتركة", "Shared promotions")}</h2>
        {canEdit && (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
            <Plus size={14} aria-hidden="true" />
            {say("عرض جديد", "New promotion")}
          </button>
        )}
      </div>
      <p className="m-0 text-xs text-[var(--color-subtle)]">
        {say("كل عرض بيتحط كعرض مقفول عند كل نشاط مملوك، لحد ما صاحبه يشغّله.", "Each promotion lands as a switched-off offer at each owned brand until its owner switches it on.")}
      </p>
      {offered && <Alert tone="success">{offered}</Alert>}

      {open && (
        <form onSubmit={submit} className="card space-y-3 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={say("اسم العرض", "Name (Arabic)")} htmlFor="pr-name">
              <input id="pr-name" required minLength={2} maxLength={120} value={f.nameAr} onChange={(e) => setF({ ...f, nameAr: e.target.value })} className={INPUT} />
            </Field>
            <Field label={say("الاسم بالإنجليزي", "Name (English)")} htmlFor="pr-name-en" hint={say("اختياري", "Optional")}>
              <input id="pr-name-en" dir="ltr" maxLength={120} value={f.nameEn} onChange={(e) => setF({ ...f, nameEn: e.target.value })} className={INPUT} />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={say("النوع", "Kind")} htmlFor="pr-kind">
              <select id="pr-kind" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as "PERCENT" | "FIXED" })} className={INPUT}>
                <option value="PERCENT">{say("نسبة %", "Percent %")}</option>
                <option value="FIXED">{say("مبلغ ثابت", "Fixed amount")}</option>
              </select>
            </Field>
            <Field label={f.kind === "PERCENT" ? say("النسبة", "Percent") : say("المبلغ بالجنيه", "Amount (EGP)")} htmlFor="pr-value">
              <input id="pr-value" type="number" required dir="ltr" min={f.kind === "PERCENT" ? 1 : 0.01} max={f.kind === "PERCENT" ? 100 : undefined}
                step={f.kind === "PERCENT" ? 1 : 0.01} value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} className={INPUT} />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={say("يبدأ", "Starts")} htmlFor="pr-start" hint={say("اختياري", "Optional")}>
              <input id="pr-start" type="date" dir="ltr" value={f.startsAt} onChange={(e) => setF({ ...f, startsAt: e.target.value })} className={INPUT} />
            </Field>
            <Field label={say("ينتهي", "Ends")} htmlFor="pr-end" hint={say("اختياري", "Optional")}>
              <input id="pr-end" type="date" dir="ltr" value={f.endsAt} onChange={(e) => setF({ ...f, endsAt: e.target.value })} className={INPUT} />
            </Field>
          </div>
          {formError && <Alert tone="danger">{formError}</Alert>}
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="btn btn-primary btn-sm">
              {busy && <Loader2 size={13} className="animate-spin" aria-hidden="true" />}
              {say("ابعت للأنشطة", "Send to brands")}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>{say("إلغاء", "Cancel")}</button>
          </div>
        </form>
      )}

      {loading && <Spinner />}
      {error && <Alert tone="danger">{error}</Alert>}
      {data && data.promotions.length === 0 && <p className="m-0 text-sm text-[var(--color-subtle)]">{say("لسه مفيش عروض.", "No promotions yet.")}</p>}
      {data && data.promotions.length > 0 && (
        <ul className="m-0 list-none space-y-2 p-0">
          {data.promotions.map((p) => (
            <li key={p.id} className="card p-4">
              <p className="m-0 font-bold">{lang === "en" && p.nameEn ? p.nameEn : p.nameAr}</p>
              <p className="num m-0 mt-1 text-xs text-[var(--color-subtle)]">
                {p.kind === "PERCENT" ? `${p.value}%` : formatCents(p.value, "EGP", lang)}
                {p.startsAt && ` · ${say("من", "from")} ${dateShort(p.startsAt, lang)}`}
                {p.endsAt && ` · ${say("لحد", "until")} ${dateShort(p.endsAt, lang)}`}
              </p>
              {p.brands.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {p.brands.map((b, i) => (
                    <StatusChip key={i} tone={b.on ? "jade" : "muted"}>
                      {b.name} · {b.on ? say("شغّال", "on") : say("مقفول", "off")}
                    </StatusChip>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PackagesSection({ base }: { base: string }) {
  const { lang, say } = useSay();
  const { data, error, loading } = useLoad<PackagesReport>(`${base}/packages`);
  const n = (v: number) => num(v, lang);
  return (
    <section aria-labelledby="opk-h" className="space-y-3">
      <h2 id="opk-h" className="m-0 text-base font-extrabold">{say("الباقات والعضويات", "Packages & memberships")}</h2>
      <p className="m-0 text-xs text-[var(--color-subtle)]">
        {say("أرقام بس، من الأنشطة المملوكة اللي بتشارك تقاريرها.", "Counts only, from owned brands that share their reports.")}
      </p>
      {loading && <Spinner />}
      {error && <Alert tone="warning">{error}</Alert>}
      {data && data.businesses.length === 0 && <p className="m-0 text-sm text-[var(--color-subtle)]">{say("مفيش بيانات.", "Nothing to show.")}</p>}
      {data && data.businesses.length > 0 && (
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[36rem] text-sm">
            <thead>
              <tr className="text-xs text-[var(--color-subtle)]">
                <th scope="col" className="p-3 text-start font-semibold">{say("النشاط", "Brand")}</th>
                <th scope="col" className="p-3 text-start font-semibold">{say("باقات اتباعت", "Packages sold")}</th>
                <th scope="col" className="p-3 text-start font-semibold">{say("جلسات", "Sessions")}</th>
                <th scope="col" className="p-3 text-start font-semibold">{say("اتستخدمت", "Used")}</th>
                <th scope="col" className="p-3 text-start font-semibold">{say("باقات شغّالة", "Active packages")}</th>
                <th scope="col" className="p-3 text-start font-semibold">{say("عضويات شغّالة", "Active memberships")}</th>
              </tr>
            </thead>
            <tbody>
              {data.businesses.map((b) => (
                <tr key={b.businessId} className="border-t border-[var(--color-line)]">
                  <td className="p-3">{b.name}</td>
                  <td className="num p-3">{n(b.packagesSold)}</td>
                  <td className="num p-3">{n(b.sessionsSold)}</td>
                  <td className="num p-3">{n(b.sessionsUsed)}</td>
                  <td className="num p-3">{n(b.activePackages)}</td>
                  <td className="num p-3">{n(b.activeMemberships)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Spinner() {
  const { say } = useSay();
  return (
    <p className="m-0 text-sm text-[var(--color-subtle)]">
      <Loader2 size={14} className="me-1 inline animate-spin" aria-hidden="true" />
      {say("بيحمّل…", "Loading…")}
    </p>
  );
}
