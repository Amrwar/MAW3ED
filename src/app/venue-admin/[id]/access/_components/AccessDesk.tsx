"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, RefreshCw, ShieldCheck } from "lucide-react";
import Link from "@/components/shared/LocaleLink";
import { useLanguage } from "@/contexts/LanguageContext";
import { localeFor } from "@/lib/fmt";
import type { Lang } from "@/lib/i18n";

/* The shapes GET /api/venues/:id/access returns (lib/access/venue-desk.ts). */
interface Row {
  entitlementId: string; visitorName: string; role: "HOLDER" | "GUEST"; businessName: string; status: string; reason: string | null; reasonText: string | null;
  validFrom: string; validUntil: string; entryUntil: string | null; gates: string[]; reentryAllowed: boolean; phoneOnFile: boolean;
  pass: { status: string; confirmedAt: string | null; lastError: string | null } | null;
  lastEvent: { kind: string; at: string; gate: string | null } | null;
}
interface Desk {
  settings: {
    accessEnabled: boolean; siteRef: string | null;
    provider: { slug: string; kind: string; name: string; usable: boolean; health: { at: string; ok: boolean | null; detail: string | null } | null } | null;
    escalationContact: string | null; identityRequirement: string;
  };
  rows: Row[];
  events: { kind: string; at: string; gate: string | null; reason: string | null; byStaff: boolean }[];
  attention: { id: string; kind: string; at: string; reason: string | null }[];
  providers: { slug: string; kind: string; name: string; usable: boolean }[];
  authority: string;
  can: { override: boolean; enable: boolean; provider: boolean };
}

/* Words for the codes the desk shows, so neither language sees an enum. */
const WORD: Record<string, [ar: string, en: string]> = {
  ELIGIBLE: ["مسموح", "Allowed"], SUSPENDED: ["موقوف", "Suspended"], REVOKED: ["اتلغى", "Cancelled"], EXPIRED: ["انتهى", "Expired"],
  PENDING_PROVIDER: ["مستني المزوّد", "Waiting for provider"], ACTIVE: ["فعّال", "Active"], REVOKE_PENDING: ["بيتلغي", "Being cancelled"], FAILED: ["فشل", "Failed"],
  CREDENTIAL_ACTIVE: ["التصريح اتفعّل", "Pass activated"], CREDENTIAL_UPDATED: ["التصريح اتحدّث", "Pass updated"], CREDENTIAL_REVOKED: ["التصريح اتلغى", "Pass cancelled"], CREDENTIAL_FAILED: ["التصريح فشل", "Pass failed"],
  ENTRY_GRANTED: ["دخل", "Entered"], ENTRY_DENIED: ["اترفض دخوله", "Entry refused"], EXIT: ["خرج", "Left"], PROVIDER_ERROR: ["خطأ من المزوّد", "Provider error"],
  OVERRIDE_SUSPEND: ["الأمن وقّف تصريح", "Security suspended a pass"], OVERRIDE_REINSTATE: ["الأمن رجّع تصريح", "Security reinstated a pass"], ESCALATION: ["تصعيد", "Escalation"],
  HOLDER: ["صاحب الحجز", "Booking holder"], GUEST: ["مرافق", "Guest"],
};
type Say = (ar: string, en: string) => string;
const clock = (iso: string, lang: Lang) =>
  new Intl.DateTimeFormat(localeFor(lang), { timeZone: "Africa/Cairo", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
const field = "w-full rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-sm";

export default function AccessDesk({ venueId, venueName }: { venueId: string; venueName: string }) {
  const { lang } = useLanguage();
  const en = lang === "en";
  const t: Say = (ar, e) => (en ? e : ar);
  const w = (k: string) => (WORD[k] ? WORD[k][en ? 1 : 0] : k);
  const at = (iso: string) => clock(iso, lang);
  const dir = en ? "ltr" : "rtl";
  const base = `/api/venues/${venueId}/access`;
  // The server words reasons, gates and errors in this language.
  const q = en ? "lang=en" : "";
  const [desk, setDesk] = useState<Desk | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [day, setDay] = useState("");
  // The day the rows on screen belong to: until the new day's answer
  // arrives, the old rows are marked as not this day's.
  const [deskDay, setDeskDay] = useState("");
  const [confirmOff, setConfirmOff] = useState(false);
  // The day now chosen, for answers that arrive after it changed.
  const chosen = useRef(day);
  useEffect(() => {
    chosen.current = day;
  }, [day]);

  const fetchDesk = useCallback(async (): Promise<{ desk: Desk | null; failure: string | null; day: string }> => {
    try {
      const query = [day ? `day=${day}` : "", q].filter(Boolean).join("&");
      const res = await fetch(`${base}${query ? `?${query}` : ""}`, { cache: "no-store" });
      if (!res.ok) {
        const failure =
          res.status === 401 ? (q ? "Sign in again." : "سجّل دخولك تاني.") : res.status === 404 ? (q ? "You don't have access here." : "مالكش صلاحية هنا.") : q ? "Something went wrong." : "حصلت مشكلة.";
        return { desk: null, day, failure };
      }
      return { desk: (await res.json()) as Desk, failure: null, day };
    } catch {
      return { desk: null, failure: q ? "Couldn't connect." : "تعذّر الاتصال.", day };
    }
  }, [base, day, q]);
  const apply = useCallback((r: { desk: Desk | null; failure: string | null; day: string }) => {
    if (r.day !== chosen.current) return; // an answer for a day no longer on screen
    if (r.desk) {
      setDesk(r.desk);
      setDeskDay(r.day);
    }
    setFailure(r.failure);
  }, []);
  const load = useCallback(async () => apply(await fetchDesk()), [apply, fetchDesk]);

  useEffect(() => {
    let live = true;
    void fetchDesk().then((r) => {
      if (live) apply(r);
    });
    return () => {
      live = false;
    };
  }, [fetchDesk, apply]);

  async function send(path: string, method: string, body: unknown, done: string) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`${base}${path}${q ? `?${q}` : ""}`, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await res.json().catch(() => ({}));
      const refused = res.status === 401 ? t("سجّل دخولك تاني.", "Sign in again.") : j.error ?? t("حصلت مشكلة.", "Something went wrong.");
      setMsg({ ok: res.ok, text: res.ok ? done : refused });
      await load();
      return res.ok;
    } catch {
      setMsg({ ok: false, text: t("تعذّر الاتصال، ومحصلش أي تغيير. جرّب تاني.", "Couldn't connect, and nothing was changed. Try again.") });
      return false;
    } finally {
      setBusy(false);
    }
  }

  if (failure && !desk) return <main className="max-w-4xl mx-auto p-6 text-sm" dir={dir}>{failure}</main>;
  if (!desk) return <main className="max-w-4xl mx-auto p-6 text-sm" dir={dir}>{t("بيحمّل…", "Loading…")}</main>;
  const s = desk.settings;
  const stale = deskDay !== day && !failure;

  return (
    <main className="max-w-5xl mx-auto p-4 sm:p-6 space-y-5" dir={dir}>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><ShieldCheck size={20} aria-hidden="true" /> {t("دخول الزوار", "Visitor access")} — {venueName}</h1>
          <p className="text-xs text-[var(--color-muted)]">
            {t(
              "الاسم والميعاد والبوابات وحالة التصريح بس. مفيش هنا تفاصيل الحجز ولا الفلوس ولا أرقام التليفونات.",
              "Names, times, gates and pass status only. No booking details, payments or phone numbers here.",
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" className={field} value={day} onChange={(e) => setDay(e.target.value)} aria-label={t("اليوم", "Day")} />
          <button type="button" className="btn btn-outline btn-sm" onClick={() => void load()} aria-label={t("حدّث", "Refresh")}><RefreshCw size={14} aria-hidden="true" /></button>
          {desk.authority !== "VENUE_SECURITY" && <Link href={`/venue-admin/${venueId}`} className="btn btn-outline btn-sm">{t("لوحة المكان", "Venue console")}</Link>}
        </div>
      </header>

      {msg && <p className={`text-sm ${msg.ok ? "text-[var(--color-ok)]" : "text-[var(--color-danger)]"}`} role="status">{msg.text}</p>}
      {failure && <p className="text-sm text-[var(--color-danger)]" role="alert">{t(`مقدرناش نحدّث: ${failure} اللي ظاهر ممكن يكون قديم.`, `Couldn't refresh: ${failure} What's shown may be out of date.`)}</p>}

      <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-white p-4 space-y-3">
        <h2 className="font-bold text-sm">{t("الإعدادات", "Settings")}</h2>
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
          <div><dt className="text-xs text-[var(--color-muted)]">{t("تصاريح الزوار", "Visitor passes")}</dt><dd className="font-bold">{s.accessEnabled ? t("شغّالة", "On") : t("مقفولة", "Off")}</dd></div>
          <div><dt className="text-xs text-[var(--color-muted)]">{t("مزوّد الدخول", "Access provider")}</dt><dd>{s.provider ? s.provider.name : t("مفيش", "None")}</dd></div>
          <div>
            <dt className="text-xs text-[var(--color-muted)]">{t("حالة المزوّد", "Provider status")}</dt>
            <dd>
              {!s.provider
                ? "—"
                : !s.provider.usable
                  ? t("مش متاح هنا", "Not available here")
                  : s.provider.health
                    ? `${s.provider.health.ok ? t("شغّال", "Working") : t("مش بيرد", "Not responding")} (${at(s.provider.health.at)})`
                    : t("لسه متكشفش عليه", "Not checked yet")}
            </dd>
          </div>
          <div><dt className="text-xs text-[var(--color-muted)]">{t("التصعيد", "Escalation")}</dt><dd>{s.escalationContact ?? "—"}</dd></div>
        </dl>
        {s.provider?.kind === "SANDBOX" && (
          <p className="rounded-[var(--radius-sm)] bg-[var(--color-warn-soft)] px-3 py-2 text-xs font-bold text-[var(--color-star)]">
            {t("المزوّد ده بيئة تجريبية: تصاريحه مش صالحة عند أي بوابة حقيقية.", "This provider is a test environment: its passes are not valid at any real gate.")}
          </p>
        )}
        {desk.can.enable && (confirmOff ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span>{t("كل التصاريح الحالية هتتوقف لحد ما تتشغل تاني. متأكد؟", "Every current pass will be suspended until passes are switched back on. Are you sure?")}</span>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              disabled={busy}
              onClick={() => {
                setConfirmOff(false);
                void send("", "PUT", { accessEnabled: false }, t("اتقفلت — التصاريح الحالية اتوقفت مؤقتًا.", "Switched off — current passes are suspended."));
              }}
            >
              {t("أيوه، اقفلها", "Yes, switch off")}
            </button>
            <button type="button" className="underline" onClick={() => setConfirmOff(false)}>{t("لأ", "No")}</button>
          </div>
        ) : (
          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={busy || (!s.accessEnabled && !s.provider?.usable)}
            onClick={() => (s.accessEnabled ? setConfirmOff(true) : void send("", "PUT", { accessEnabled: true }, t("اشتغلت.", "Switched on.")))}
          >
            {s.accessEnabled ? t("اقفل تصاريح الزوار", "Switch off visitor passes") : t("شغّل تصاريح الزوار", "Switch on visitor passes")}
          </button>
        ))}
        {desk.can.provider && <ProviderForm desk={desk} busy={busy} send={send} t={t} />}
      </section>

      {desk.attention.length > 0 && (
        <section className="rounded-[var(--radius-lg)] border border-[var(--color-warn-line)] bg-[var(--color-warn-soft)] p-4 space-y-2">
          <h2 className="font-bold text-sm flex items-center gap-2"><AlertTriangle size={16} aria-hidden="true" /> {t("محتاج حد يتابع", "Needs someone to follow up")}</h2>
          <ul className="text-sm space-y-1">
            {desk.attention.map((a) => <li key={a.id}>{at(a.at)} — {w(a.kind)}{a.reason ? `: ${a.reason}` : ""}</li>)}
          </ul>
        </section>
      )}

      <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-white p-4 space-y-3">
        <h2 className="font-bold text-sm">{t("التصاريح", "Passes")} ({desk.rows.length})</h2>
        {stale && <p className="text-xs text-[var(--color-muted)]" role="status">{t("بيحمّل اليوم اللي اخترته… اللي تحت لسه بتاع يوم تاني.", "Loading the day you chose… what's below is still another day's.")}</p>}
        {desk.rows.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">{t("مفيش تصاريح في اليوم ده.", "No passes on this day.")}</p>
        ) : (
          <div className={`overflow-x-auto ${stale ? "opacity-50" : ""}`}>
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-[var(--color-muted)] text-start">
                <th className="p-2 text-start">{t("الزائر", "Visitor")}</th><th className="p-2 text-start">{t("رايح لـ", "Visiting")}</th><th className="p-2 text-start">{t("الوقت", "Time")}</th>
                <th className="p-2 text-start">{t("الحق", "Right")}</th><th className="p-2 text-start">{t("التصريح", "Pass")}</th><th className="p-2 text-start">{t("آخر حاجة", "Latest")}</th>
                {desk.can.override && <th className="p-2" />}
              </tr></thead>
              <tbody>
                {desk.rows.map((r) => (
                  <tr key={r.entitlementId} className="border-t border-[var(--color-line)] align-top">
                    <td className="p-2">{r.visitorName}<div className="text-xs text-[var(--color-muted)]">{w(r.role)}</div></td>
                    <td className="p-2">{r.businessName}</td>
                    <td className="p-2" dir="ltr">{at(r.validFrom)}–{at(r.validUntil)}{r.entryUntil ? <div className="text-xs">≤ {at(r.entryUntil)}</div> : null}</td>
                    <td className="p-2">{w(r.status)}{r.reasonText ? <div className="text-xs text-[var(--color-muted)]">{r.reasonText}</div> : null}</td>
                    <td className="p-2">{r.pass ? w(r.pass.status) : "—"}{r.pass?.lastError ? <div className="text-xs text-[var(--color-danger)]">{r.pass.lastError}</div> : null}</td>
                    <td className="p-2">{r.lastEvent ? `${w(r.lastEvent.kind)} ${at(r.lastEvent.at)}${r.lastEvent.gate ? ` — ${r.lastEvent.gate}` : ""}` : "—"}</td>
                    {desk.can.override && (
                      <td className="p-2"><Override row={r} busy={busy} send={send} t={t} /></td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {desk.can.override && <EscalateForm busy={busy} send={send} t={t} />}

      <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-white p-4 space-y-2">
        <h2 className="font-bold text-sm">{t("آخر الأحداث", "Recent events")}</h2>
        {desk.events.length === 0 ? <p className="text-sm text-[var(--color-muted)]">{t("مفيش.", "None.")}</p> : (
          <ul className="text-sm space-y-1">
            {desk.events.map((e, i) => (
              <li key={i}>{at(e.at)} — {w(e.kind)}{e.gate ? ` (${e.gate})` : ""}{e.reason ? `: ${e.reason}` : ""}{e.byStaff ? t(" · بواسطة الأمن", " · by security") : ""}</li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

type Send = (path: string, method: string, body: unknown, done: string) => Promise<boolean>;

function Override({ row, busy, send, t }: { row: Row; busy: boolean; send: Send; t: Say }) {
  const [note, setNote] = useState("");
  const action = row.status === "ELIGIBLE" ? "suspend" : row.status === "SUSPENDED" && row.reason === "security-override" ? "reinstate" : null;
  if (!action) return null;
  return (
    <form
      className="flex gap-1"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await send(`/entitlements/${row.entitlementId}`, "POST", { action, note }, action === "suspend" ? t("اتوقف.", "Suspended.") : t("رجع.", "Reinstated."))) setNote("");
      }}
    >
      <input className={field} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("السبب", "Reason")} aria-label={t("السبب", "Reason")} required minLength={3} maxLength={300} />
      <button type="submit" className="btn btn-outline btn-sm" disabled={busy}>{action === "suspend" ? t("وقّف", "Suspend") : t("رجّع", "Reinstate")}</button>
    </form>
  );
}

function EscalateForm({ busy, send, t }: { busy: boolean; send: Send; t: Say }) {
  const [note, setNote] = useState("");
  return (
    <form
      className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-white p-4 space-y-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await send("/escalations", "POST", { note }, t("اتسجّل التصعيد.", "Escalation recorded."))) setNote("");
      }}
    >
      <h2 className="font-bold text-sm">{t("سجّل تصعيد", "Record an escalation")}</h2>
      <textarea className={field} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("اللي حصل", "What happened")} aria-label={t("اللي حصل", "What happened")} required minLength={3} maxLength={300} />
      <button type="submit" className="btn btn-outline btn-sm" disabled={busy}>{t("سجّل", "Record")}</button>
    </form>
  );
}

function ProviderForm({ desk, busy, send, t }: { desk: Desk; busy: boolean; send: Send; t: Say }) {
  const [slug, setSlug] = useState(desk.settings.provider?.slug ?? "");
  const [siteRef, setSiteRef] = useState(desk.settings.siteRef ?? "");
  return (
    <form
      className="grid gap-2 sm:grid-cols-3 border-t border-[var(--color-line)] pt-3"
      onSubmit={(e) => {
        e.preventDefault();
        void send("", "PUT", { providerSlug: slug || null, siteRef: siteRef || null }, t("اتحفظ المزوّد.", "Provider saved."));
      }}
    >
      <select className={field} value={slug} onChange={(e) => setSlug(e.target.value)} aria-label={t("مزوّد الدخول", "Access provider")}>
        <option value="">{t("من غير مزوّد", "No provider")}</option>
        {desk.providers.map((p) => (
          <option key={p.slug} value={p.slug} disabled={!p.usable}>{p.name}{p.usable ? "" : t(" (مش متاح هنا)", " (not available here)")}</option>
        ))}
      </select>
      <input className={field} value={siteRef} onChange={(e) => setSiteRef(e.target.value)} placeholder={t("كود المكان عند المزوّد", "Venue code at the provider")} aria-label={t("كود المكان عند المزوّد", "Venue code at the provider")} dir="ltr" />
      <button type="submit" className="btn btn-outline btn-sm" disabled={busy}>{t("احفظ (إدارة موعد بس)", "Save (Maw3ed administrators only)")}</button>
    </form>
  );
}
