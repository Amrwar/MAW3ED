"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, ExternalLink } from "lucide-react";
import Link from "@/components/shared/LocaleLink";
import { useLanguage } from "@/contexts/LanguageContext";
import ScopePicker from "@/components/organizations/ScopePicker";
import { RELATIONSHIP_HINTS, RELATIONSHIP_LABELS, SCOPE_LABELS, type Relationship } from "@/lib/organizations/scopes";

interface OrgOption {
  id: string; slug: string; kind: string; nameAr: string; nameEn: string | null; isPublished: boolean;
  city: { nameAr: string; nameEn: string } | null;
}
interface Association {
  id: string; status: string; relation: string; note: string | null; createdAt: string;
  requestedScopes: string[]; scopes: string[]; expiresAt: string | null; suspendedAt: string | null;
  /** True when this business paused it — only then may it resume. */
  suspendedByBusiness: boolean;
  branch: { id: string; nameAr: string; nameEn: string | null } | null;
  organization: { id: string; slug: string; kind: string; nameAr: string; nameEn: string | null; isPublished: boolean; status: string };
}

const field = "w-full rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-sm";

/** A date picked in the form, as the end of that Cairo day. */
const endOfDay = (d: string) => (d ? `${d}T23:59:59+02:00` : null);

/**
 * The business owner's side of organizations: answer invitations, ask
 * to join, and decide — alone — what any organization may operate.
 * Owned and managed relationships carry scopes this owner grants, can
 * narrow, pause or withdraw at any moment; hosted ones (a mall) are a
 * listing and never carry access.
 */
export default function OrgMembershipClient() {
  const { lang } = useLanguage();
  const en = lang === "en";
  const t = (ar: string, e: string) => (en ? e : ar);
  const nm = (x: { nameAr: string; nameEn?: string | null }) => (en ? x.nameEn || x.nameAr : x.nameAr);
  const relName = (r: string) => {
    const l = RELATIONSHIP_LABELS[r as Relationship];
    return l ? (en ? l[1] : l[0]) : r;
  };
  const scopeNames = (list: string[]) =>
    list.map((sc) => SCOPE_LABELS[sc as keyof typeof SCOPE_LABELS]?.[en ? 1 : 0] ?? sc).join(en ? ", " : "، ");

  const [organizations, setOrganizations] = useState<OrgOption[]>([]);
  const [branches, setBranches] = useState<{ id: string; nameAr: string; nameEn: string | null }[]>([]);
  const [associations, setAssociations] = useState<Association[]>([]);
  const [form, setForm] = useState<{ organizationId: string; branchId: string; relation: Relationship; scopes: string[]; until: string }>({
    organizationId: "", branchId: "", relation: "HOSTED", scopes: [], until: "",
  });
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
  const patch = (id: string, body: Record<string, unknown>, done: string) => send(`/api/business/organizations/${id}`, "PATCH", body, done);

  const status: Record<string, string> = {
    INVITED: t("دعوة مستنية ردك", "Invitation awaiting your answer"),
    REQUESTED: t("مستني رد الجهة", "Waiting for the organization"),
    APPROVED: t("مرتبط", "Active"),
    SUSPENDED: t("موقوف مؤقتًا", "Paused"),
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
            "مجموعة بتملك نشاطك، مول بيستضيفه، أو شركة بتديره — كل علاقة لوحدها، ونشاطك يفضل ملكك. إنت بس اللي بتحدد إيه اللي أي جهة تقدر تديره، وتقدر تسحبه في أي لحظة.",
            "A group that owns your business, a mall that hosts it, or a company that manages it — each its own relationship, and your business stays yours. Only you decide what any organization may operate, and you can withdraw it at any moment.",
          )}
        </p>
      </header>

      {loadFailed && (
        <p role="alert" className="m-0 flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-warn-line)] bg-[var(--color-warn-soft)] p-3 text-sm text-[var(--color-warn)]">
          {t("مقدرناش نحمّل البيانات.", "Could not load.")}
          <button type="button" className="btn btn-outline btn-sm" onClick={() => void reload()}>{t("جرّب تاني", "Try again")}</button>
        </p>
      )}

      <p role="status" className={`m-0 min-h-5 text-sm ${msg?.ok ? "text-[var(--color-ok)]" : "text-[var(--color-danger)]"}`}>{msg?.text}</p>

      <section className="card space-y-3 p-5" aria-labelledby="mine-h">
        <h2 id="mine-h" className="m-0 text-base font-extrabold">{t("علاقاتك", "Your relationships")}</h2>
        {associations.length === 0 ? (
          <p className="m-0 text-sm text-[var(--color-subtle)]">{t("لسه مفيش.", "None yet.")}</p>
        ) : (
          <ul className="m-0 list-none divide-y divide-[var(--color-line)] p-0">
            {associations.map((a) => {
              const operates = a.relation === "OWNED" || a.relation === "MANAGED";
              return (
                <li key={a.id} className="space-y-2 py-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="m-0 flex items-center gap-2 font-bold">
                        <Building2 size={15} aria-hidden="true" />
                        {nm(a.organization)}
                        {a.branch ? <span className="font-normal text-[var(--color-subtle)]">· {nm(a.branch)}</span> : null}
                      </p>
                      <p className="m-0 text-xs text-[var(--color-subtle)]">
                        {relName(a.relation)} · {status[a.status] ?? a.status}
                        {a.note && a.status === "INVITED" ? ` · ${a.note}` : ""}
                        {a.status === "APPROVED" && !a.organization.isPublished && a.relation !== "MANAGED" ? t(" · صفحة الجهة لسه مش منشورة", " · the organization's page is not public yet") : ""}
                      </p>
                      {operates && a.status !== "INVITED" && (
                        <p className="m-0 text-xs">
                          {a.scopes.length
                            ? <>{t("مسموح لها: ", "Allowed: ")}{scopeNames(a.scopes)}</>
                            : t("مش مسموح لها تدير أي حاجة.", "Not allowed to operate anything.")}
                          {a.expiresAt ? <> · {t("لحد ", "until ")}<span className="num" dir="ltr">{a.expiresAt.slice(0, 10)}</span></> : null}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {a.status === "APPROVED" && a.organization.isPublished && a.relation !== "MANAGED" && (
                        <Link href={`/groups/${a.organization.slug}`} target="_blank" className="btn btn-ghost btn-sm gap-1">
                          <ExternalLink size={14} aria-hidden="true" />
                          {t("الصفحة", "Page")}
                        </Link>
                      )}
                      {!operates && a.status === "INVITED" && (
                        <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => patch(a.id, { action: "accept" }, t("اتقبلت.", "Accepted."))}>
                          {t("اقبل", "Accept")}
                        </button>
                      )}
                      {a.status === "INVITED" && (
                        <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => patch(a.id, { action: "decline" }, t("اترفضت الدعوة.", "Declined."))}>
                          {t("ارفض", "Decline")}
                        </button>
                      )}
                      {a.status === "APPROVED" && (
                        <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => patch(a.id, { action: "suspend" }, t("اتوقفت مؤقتًا.", "Paused."))}>
                          {t("إيقاف مؤقت", "Pause")}
                        </button>
                      )}
                      {a.status === "SUSPENDED" && a.suspendedByBusiness && (
                        <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => patch(a.id, { action: "resume" }, t("رجعت.", "Resumed."))}>
                          {t("رجّعها", "Resume")}
                        </button>
                      )}
                      {(a.status === "REQUESTED" || a.status === "APPROVED" || a.status === "SUSPENDED") && (
                        <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => patch(a.id, { action: "leave" }, t("خرجت.", "Left."))}>
                          {a.status === "REQUESTED" ? t("اسحب الطلب", "Withdraw") : t("انهي العلاقة", "End relationship")}
                        </button>
                      )}
                    </div>
                  </div>
                  {operates && (a.status === "INVITED" || a.status === "APPROVED" || a.status === "SUSPENDED" || a.status === "REQUESTED") && (
                    <AccessEditor
                      key={`${a.id}-${a.status}-${a.scopes.join(",")}`}
                      t={t}
                      en={en}
                      a={a}
                      busy={busy}
                      onSave={(scopes, until) =>
                        patch(
                          a.id,
                          { action: a.status === "INVITED" ? "accept" : "grant", scopes, expiresAt: endOfDay(until) },
                          a.status === "INVITED" ? t("اتقبلت بالصلاحيات دي.", "Accepted with this access.") : t("الصلاحيات اتحدثت.", "Access updated."),
                        )
                      }
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const body = {
            organizationId: form.organizationId,
            branchId: form.branchId || null,
            relation: form.relation,
            scopes: form.relation === "HOSTED" ? [] : form.scopes,
            expiresAt: form.relation === "HOSTED" ? null : endOfDay(form.until),
          };
          if (await send("/api/business/organizations", "POST", body, t("الطلب اتبعت.", "Request sent."))) {
            setForm({ organizationId: "", branchId: "", relation: "HOSTED", scopes: [], until: "" });
          }
        }}
        className="card space-y-3 p-5"
        aria-labelledby="req-h"
      >
        <h2 id="req-h" className="m-0 text-base font-extrabold">{t("اطلب علاقة مع جهة", "Ask an organization")}</h2>
        {organizations.length === 0 ? (
          <p className="m-0 text-sm text-[var(--color-subtle)]">{t("لسه مفيش جهات بتقبل طلبات.", "No organizations are taking requests yet.")}</p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="space-y-1 text-sm">
                <span className="font-bold">{t("الجهة", "Organization")}</span>
                <select className={field} value={form.organizationId} onChange={(e) => setForm({ ...form, organizationId: e.target.value })} required>
                  <option value="">{t("اختار", "Choose")}</option>
                  {organizations.map((o) => (
                    <option key={o.id} value={o.id}>{nm(o)}{o.city ? ` — ${nm(o.city)}` : ""}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-bold">{t("نوع العلاقة", "Relationship")}</span>
                <select className={field} value={form.relation} onChange={(e) => setForm({ ...form, relation: e.target.value as Relationship, scopes: [] })}>
                  {(["HOSTED", "OWNED", "MANAGED"] as const).map((r) => <option key={r} value={r}>{relName(r)}</option>)}
                </select>
              </label>
              {branches.length > 0 && (
                <label className="space-y-1 text-sm">
                  <span className="font-bold">{t("الفرع", "Branch")}</span>
                  <select className={field} value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value, scopes: [] })}>
                    <option value="">{t("النشاط كله", "The whole business")}</option>
                    {branches.map((b) => <option key={b.id} value={b.id}>{nm(b)}</option>)}
                  </select>
                </label>
              )}
            </div>
            <p className="m-0 text-xs text-[var(--color-subtle)]">{en ? RELATIONSHIP_HINTS[form.relation][1] : RELATIONSHIP_HINTS[form.relation][0]}</p>
            <ScopePicker
              relation={form.relation}
              branchId={form.branchId || null}
              value={form.scopes}
              onChange={(scopes) => setForm({ ...form, scopes })}
              en={en}
              legend={t("هتسمح للجهة تدير:", "You allow the organization to operate:")}
            />
            {form.relation !== "HOSTED" && form.scopes.length > 0 && (
              <label className="block max-w-xs space-y-1 text-sm">
                <span className="font-bold">{t("لحد تاريخ (اختياري)", "Until (optional)")}</span>
                <input className={field} type="date" value={form.until} onChange={(e) => setForm({ ...form, until: e.target.value })} dir="ltr" />
              </label>
            )}
            <button type="submit" className="btn btn-primary" disabled={busy || !form.organizationId}>{t("ابعت الطلب", "Send request")}</button>
          </>
        )}
      </form>
    </div>
  );
}

/**
 * What an owning or managing organization may operate, set by this
 * owner: on an invitation (defaulting to what was asked), or later
 * (narrow, widen, or withdraw everything at once).
 */
function AccessEditor({
  t,
  en,
  a,
  busy,
  onSave,
}: {
  t: (ar: string, en: string) => string;
  en: boolean;
  a: Association;
  busy: boolean;
  onSave: (scopes: string[], until: string) => Promise<boolean>;
}) {
  const [scopes, setScopes] = useState<string[]>(a.status === "INVITED" ? a.requestedScopes : a.scopes);
  const [until, setUntil] = useState(a.expiresAt ? a.expiresAt.slice(0, 10) : "");
  return (
    <div className="space-y-2 rounded-[var(--radius-md)] border border-[var(--color-line)] p-3">
      <ScopePicker
        relation={a.relation}
        branchId={a.branch?.id ?? null}
        value={scopes}
        onChange={setScopes}
        en={en}
        legend={a.status === "INVITED" ? t("لو قبلت، الجهة هتقدر تدير:", "If you accept, the organization may operate:") : t("الجهة تقدر تدير:", "The organization may operate:")}
      />
      <div className="flex flex-wrap items-end gap-2">
        <label className="space-y-1 text-sm">
          <span className="block text-xs font-bold">{t("لحد تاريخ (اختياري)", "Until (optional)")}</span>
          <input className={field} type="date" value={until} onChange={(e) => setUntil(e.target.value)} dir="ltr" />
        </label>
        <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void onSave(scopes, until)}>
          {a.status === "INVITED" ? t("اقبل بالصلاحيات دي", "Accept with this access") : t("احفظ الصلاحيات", "Save access")}
        </button>
        {a.status !== "INVITED" && a.scopes.length > 0 && (
          <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => void onSave([], "")}>
            {t("اسحب كل الصلاحيات", "Withdraw all access")}
          </button>
        )}
      </div>
    </div>
  );
}
