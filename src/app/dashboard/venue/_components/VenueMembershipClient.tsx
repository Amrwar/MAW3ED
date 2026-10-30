"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, ExternalLink } from "lucide-react";
import Link from "@/components/shared/LocaleLink";
import { useLanguage } from "@/contexts/LanguageContext";

interface VenueOption {
  id: string; slug: string; nameAr: string; nameEn: string | null; isPublished: boolean;
  city: { nameAr: string; nameEn: string }; compound: { nameAr: string; nameEn: string | null } | null;
}
interface Membership {
  id: string; status: string; unit: string | null; requestedAt: string; decisionNote: string | null;
  venue: { id: string; slug: string; nameAr: string; nameEn: string | null; isPublished: boolean; status: string };
  branch: { nameAr: string; nameEn: string | null } | null;
  zone: { nameAr: string; nameEn: string | null } | null;
}

const field = "w-full rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-sm";

export default function VenueMembershipClient() {
  const { lang } = useLanguage();
  const en = lang === "en";
  const t = (ar: string, e: string) => (en ? e : ar);
  const nm = (x: { nameAr: string; nameEn?: string | null }) => (en ? x.nameEn || x.nameAr : x.nameAr);

  const [venues, setVenues] = useState<VenueOption[]>([]);
  const [branches, setBranches] = useState<{ id: string; nameAr: string; nameEn: string | null }[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [form, setForm] = useState({ venueId: "", branchId: "", unit: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const apply = useCallback((json: { venues: VenueOption[]; branches: typeof branches; memberships: Membership[] }) => {
    setVenues(json.venues);
    setBranches(json.branches);
    setMemberships(json.memberships);
  }, []);

  const [loadFailed, setLoadFailed] = useState(false);

  const reload = useCallback(async () => {
    const res = await fetch("/api/business/venues", { cache: "no-store" }).catch(() => null);
    if (res?.ok) {
      apply(await res.json());
      setLoadFailed(false);
    } else setLoadFailed(true);
  }, [apply]);

  useEffect(() => {
    let live = true;
    fetch("/api/business/venues", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!live) return;
        if (j) apply(j);
        else setLoadFailed(true);
      })
      .catch(() => {
        if (live) setLoadFailed(true);
      });
    return () => {
      live = false;
    };
  }, [apply]);

  async function request(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/business/venues/memberships", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ venueId: form.venueId, branchId: form.branchId || null, unit: form.unit || null }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    setMsg({ ok: res.ok, text: res.ok ? t("الطلب اتبعت لإدارة المكان. هتشوف الرد هنا.", "Request sent to the venue's management. Their answer will show here.") : json.error ?? t("حصلت مشكلة.", "Something went wrong.") });
    if (res.ok) setForm({ venueId: "", branchId: "", unit: "" });
    await reload();
    setBusy(false);
  }

  async function withdraw(id: string) {
    setBusy(true);
    const res = await fetch(`/api/business/venues/memberships/${id}`, { method: "DELETE" });
    setMsg({ ok: res.ok, text: res.ok ? t("اتسحب.", "Withdrawn.") : t("مقدرناش نسحبه.", "Could not withdraw.") });
    await reload();
    setBusy(false);
  }

  const status: Record<string, string> = {
    REQUESTED: t("مستني رد المكان", "Waiting for the venue"),
    APPROVED: t("معروض في المكان", "Listed in the venue"),
    REJECTED: t("المكان رفض", "Declined by the venue"),
    REMOVED: t("اتشال", "Ended"),
  };

  return (
    <div className="mx-auto max-w-[900px] space-y-6">
      <header className="space-y-1">
        <h1 className="m-0 text-[1.625rem] font-black tracking-tight text-[var(--color-ink)]">{t("المول أو المجمع", "Mall or complex")}</h1>
        <p className="m-0 text-sm text-[var(--color-muted)]">
          {t(
            "لو نشاطك (أو فرع منه) جوه مول أو مجمع موجود على موعد، اطلب تتعرض في صفحته. إدارة المكان هي اللي بتوافق. مش مطلوب — نشاطك شغال عادي من غيره.",
            "If your business (or one branch) is inside a mall or complex on Maw3ed, ask to be listed on its page. The venue's management approves. Optional — your business works normally without it.",
          )}
        </p>
        <p className="m-0 text-xs text-[var(--color-subtle)]">
          {t("إدارة المكان بتشوف اسم نشاطك وفرعك وعدد الحجوزات بس — مش عملاءك ولا تفاصيل حجوزاتهم ولا مدفوعاتهم.", "The venue sees your business and branch name and booking counts only — never your customers, their bookings or payments.")}
        </p>
      </header>

      {loadFailed && (
        <p role="alert" className="m-0 flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-warn-line)] bg-[var(--color-warn-soft)] p-3 text-sm text-[var(--color-warn)]">
          {t("مقدرناش نحمّل البيانات.", "Could not load your venue information.")}
          <button type="button" className="btn btn-outline btn-sm" onClick={() => void reload()}>{t("جرّب تاني", "Try again")}</button>
        </p>
      )}

      <section className="card space-y-3 p-5" aria-labelledby="mine-h">
        <h2 id="mine-h" className="m-0 text-base font-extrabold">{t("طلباتك", "Your requests")}</h2>
        {memberships.length === 0 ? (
          <p className="m-0 text-sm text-[var(--color-subtle)]">{t("لسه مفيش.", "None yet.")}</p>
        ) : (
          <ul className="m-0 list-none divide-y divide-[var(--color-line)] p-0">
            {memberships.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <p className="m-0 flex items-center gap-2 font-bold">
                    <Building2 size={15} aria-hidden="true" />
                    {nm(m.venue)}
                    {m.branch ? <span className="font-normal text-[var(--color-subtle)]">· {nm(m.branch)}</span> : null}
                  </p>
                  <p className="m-0 text-xs text-[var(--color-subtle)]">
                    {status[m.status] ?? m.status}
                    {m.zone ? ` · ${nm(m.zone)}` : ""}
                    {m.unit ? ` · ${t("وحدة", "Unit")} ${m.unit}` : ""}
                    {m.decisionNote && m.status === "REJECTED" ? ` · ${m.decisionNote}` : ""}
                    {m.status === "APPROVED" && !m.venue.isPublished ? t(" · صفحة المكان لسه مش منشورة", " · the venue's page is not public yet") : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  {m.status === "APPROVED" && m.venue.isPublished && (
                    <Link href={`/venues/${m.venue.slug}`} target="_blank" className="btn btn-ghost btn-sm gap-1">
                      <ExternalLink size={14} aria-hidden="true" />
                      {t("صفحة المكان", "Venue page")}
                    </Link>
                  )}
                  {(m.status === "REQUESTED" || m.status === "APPROVED") && (
                    <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => withdraw(m.id)}>
                      {m.status === "REQUESTED" ? t("اسحب الطلب", "Withdraw") : t("اخرج من المكان", "Leave venue")}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <form onSubmit={request} className="card space-y-3 p-5" aria-labelledby="req-h">
        <h2 id="req-h" className="m-0 text-base font-extrabold">{t("اطلب تتعرض في مكان", "Ask to be listed")}</h2>
        {venues.length === 0 ? (
          <p className="m-0 text-sm text-[var(--color-subtle)]">{t("لسه مفيش أماكن بتقبل طلبات.", "No venues are taking requests yet.")}</p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="space-y-1 text-sm">
                <span className="font-bold">{t("المكان", "Venue")}</span>
                <select className={field} value={form.venueId} onChange={(e) => setForm({ ...form, venueId: e.target.value })} required>
                  <option value="">{t("اختار", "Choose")}</option>
                  {venues.map((v) => (
                    <option key={v.id} value={v.id}>{nm(v)} — {nm(v.city)}{v.compound ? `، ${nm(v.compound)}` : ""}</option>
                  ))}
                </select>
              </label>
              {branches.length > 0 && (
                <label className="space-y-1 text-sm">
                  <span className="font-bold">{t("الفرع", "Branch")}</span>
                  <select className={field} value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })} required={branches.length > 1}>
                    {branches.length > 1 ? <option value="">{t("اختار الفرع اللي جوه المكان", "Choose the branch inside it")}</option> : <option value="">{t("النشاط كله", "The whole business")}</option>}
                    {branches.map((b) => <option key={b.id} value={b.id}>{nm(b)}</option>)}
                  </select>
                </label>
              )}
              <label className="space-y-1 text-sm">
                <span className="font-bold">{t("رقم الوحدة (اختياري)", "Unit (optional)")}</span>
                <input className={field} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} maxLength={40} />
              </label>
            </div>
            <button type="submit" className="btn btn-primary" disabled={busy || !form.venueId}>{t("ابعت الطلب", "Send request")}</button>
          </>
        )}
        <p role="status" className={`m-0 min-h-5 text-sm ${msg?.ok ? "text-[var(--color-ok)]" : "text-[var(--color-danger)]"}`}>{msg?.text}</p>
      </form>
    </div>
  );
}
