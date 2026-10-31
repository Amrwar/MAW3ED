"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, ExternalLink } from "lucide-react";
import Link from "@/components/shared/LocaleLink";
import { useLanguage } from "@/contexts/LanguageContext";

interface OrgOption {
  id: string; slug: string; kind: string; nameAr: string; nameEn: string | null; isPublished: boolean;
  city: { nameAr: string; nameEn: string } | null;
}
interface Association {
  id: string; status: string; relation: string; note: string | null; createdAt: string;
  branch: { nameAr: string; nameEn: string | null } | null;
  organization: { id: string; slug: string; kind: string; nameAr: string; nameEn: string | null; isPublished: boolean; status: string };
}

const field = "w-full rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-sm";

export default function OrgMembershipClient() {
  const { lang } = useLanguage();
  const en = lang === "en";
  const t = (ar: string, e: string) => (en ? e : ar);
  const nm = (x: { nameAr: string; nameEn?: string | null }) => (en ? x.nameEn || x.nameAr : x.nameAr);

  const [organizations, setOrganizations] = useState<OrgOption[]>([]);
  const [branches, setBranches] = useState<{ id: string; nameAr: string; nameEn: string | null }[]>([]);
  const [associations, setAssociations] = useState<Association[]>([]);
  const [form, setForm] = useState({ organizationId: "", branchId: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  const apply = useCallback((j: { organizations: OrgOption[]; branches: typeof branches; associations: Association[] }) => {
    setOrganizations(j.organizations);
    setBranches(j.branches);
    setAssociations(j.associations);
  }, []);

  const reload = useCallback(async () => {
    const res = await fetch("/api/business/organizations", { cache: "no-store" }).catch(() => null);
    if (res?.ok) {
      apply(await res.json());
      setLoadFailed(false);
    } else setLoadFailed(true);
  }, [apply]);

  useEffect(() => {
    let live = true;
    fetch("/api/business/organizations", { cache: "no-store" })
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

  async function send(path: string, method: string, body: unknown, done: string) {
    setBusy(true);
    setMsg(null);
    const res = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const json = ((await res?.json().catch(() => ({}))) ?? {}) as { error?: string };
    setMsg({ ok: !!res?.ok, text: res?.ok ? done : json.error ?? t("حصلت مشكلة.", "Something went wrong.") });
    await reload();
    setBusy(false);
    return !!res?.ok;
  }

  const status: Record<string, string> = {
    INVITED: t("دعوة مستنية ردك", "Invitation awaiting your answer"),
    REQUESTED: t("مستني رد الجهة", "Waiting for the organization"),
    APPROVED: t("منضم", "Member"),
    DECLINED: t("رفضت الدعوة", "You declined"),
    REJECTED: t("الجهة رفضت", "Declined by the organization"),
    REMOVED: t("انتهى", "Ended"),
  };

  return (
    <div className="mx-auto max-w-[900px] space-y-6">
      <header className="space-y-1">
        <h1 className="m-0 text-[1.625rem] font-black tracking-tight text-[var(--color-ink)]">{t("الجهات والمجموعات", "Organizations and groups")}</h1>
        <p className="m-0 text-sm text-[var(--color-muted)]">
          {t(
            "لو نشاطك تابع لمجموعة أو معروض عند جهة (مول، مجمع، سلسلة…) هتلاقي دعواتها هنا، وتقدر تطلب الانضمام. نشاطك يفضل ملكك بالكامل: بياناتك وعملاءك وفلوسك محدش غيرك يشوفها.",
            "If your business belongs to a group or is listed with an organization (a mall, compound, chain…), its invitations arrive here, and you can ask to join. Your business stays entirely yours: your data, customers and money are visible to nobody else.",
          )}
        </p>
      </header>

      {loadFailed && (
        <p role="alert" className="m-0 flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-warn-line)] bg-[var(--color-warn-soft)] p-3 text-sm text-[var(--color-warn)]">
          {t("مقدرناش نحمّل البيانات.", "Could not load.")}
          <button type="button" className="btn btn-outline btn-sm" onClick={() => void reload()}>{t("جرّب تاني", "Try again")}</button>
        </p>
      )}

      <section className="card space-y-3 p-5" aria-labelledby="mine-h">
        <h2 id="mine-h" className="m-0 text-base font-extrabold">{t("ارتباطاتك", "Your memberships")}</h2>
        {associations.length === 0 ? (
          <p className="m-0 text-sm text-[var(--color-subtle)]">{t("لسه مفيش.", "None yet.")}</p>
        ) : (
          <ul className="m-0 list-none divide-y divide-[var(--color-line)] p-0">
            {associations.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <p className="m-0 flex items-center gap-2 font-bold">
                    <Building2 size={15} aria-hidden="true" />
                    {nm(a.organization)}
                    {a.branch ? <span className="font-normal text-[var(--color-subtle)]">· {nm(a.branch)}</span> : null}
                  </p>
                  <p className="m-0 text-xs text-[var(--color-subtle)]">
                    {status[a.status] ?? a.status}
                    {a.note && a.status === "INVITED" ? ` · ${a.note}` : ""}
                    {a.status === "APPROVED" && !a.organization.isPublished ? t(" · صفحة الجهة لسه مش منشورة", " · the organization's page is not public yet") : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  {a.status === "APPROVED" && a.organization.isPublished && (
                    <Link href={`/groups/${a.organization.slug}`} target="_blank" className="btn btn-ghost btn-sm gap-1">
                      <ExternalLink size={14} aria-hidden="true" />
                      {t("الصفحة", "Page")}
                    </Link>
                  )}
                  {a.status === "INVITED" && (
                    <>
                      <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => send(`/api/business/organizations/${a.id}`, "PATCH", { action: "accept" }, t("انضميت.", "Joined."))}>
                        {t("اقبل", "Accept")}
                      </button>
                      <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => send(`/api/business/organizations/${a.id}`, "PATCH", { action: "decline" }, t("اترفضت الدعوة.", "Declined."))}>
                        {t("ارفض", "Decline")}
                      </button>
                    </>
                  )}
                  {(a.status === "REQUESTED" || a.status === "APPROVED") && (
                    <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => send(`/api/business/organizations/${a.id}`, "PATCH", { action: "leave" }, t("خرجت.", "Left."))}>
                      {a.status === "REQUESTED" ? t("اسحب الطلب", "Withdraw") : t("اخرج", "Leave")}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (await send("/api/business/organizations", "POST", { organizationId: form.organizationId, branchId: form.branchId || null }, t("الطلب اتبعت.", "Request sent."))) {
            setForm({ organizationId: "", branchId: "" });
          }
        }}
        className="card space-y-3 p-5"
        aria-labelledby="req-h"
      >
        <h2 id="req-h" className="m-0 text-base font-extrabold">{t("اطلب الانضمام لجهة", "Ask to join")}</h2>
        {organizations.length === 0 ? (
          <p className="m-0 text-sm text-[var(--color-subtle)]">{t("لسه مفيش جهات بتقبل طلبات.", "No organizations are taking requests yet.")}</p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="font-bold">{t("الجهة", "Organization")}</span>
                <select className={field} value={form.organizationId} onChange={(e) => setForm({ ...form, organizationId: e.target.value })} required>
                  <option value="">{t("اختار", "Choose")}</option>
                  {organizations.map((o) => (
                    <option key={o.id} value={o.id}>{nm(o)}{o.city ? ` — ${nm(o.city)}` : ""}</option>
                  ))}
                </select>
              </label>
              {branches.length > 0 && (
                <label className="space-y-1 text-sm">
                  <span className="font-bold">{t("الفرع", "Branch")}</span>
                  <select className={field} value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
                    <option value="">{t("النشاط كله", "The whole business")}</option>
                    {branches.map((b) => <option key={b.id} value={b.id}>{nm(b)}</option>)}
                  </select>
                </label>
              )}
            </div>
            <button type="submit" className="btn btn-primary" disabled={busy || !form.organizationId}>{t("ابعت الطلب", "Send request")}</button>
          </>
        )}
        <p role="status" className={`m-0 min-h-5 text-sm ${msg?.ok ? "text-[var(--color-ok)]" : "text-[var(--color-danger)]"}`}>{msg?.text}</p>
      </form>
    </div>
  );
}
