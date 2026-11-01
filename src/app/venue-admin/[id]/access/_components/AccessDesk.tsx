"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, RefreshCw, ShieldCheck } from "lucide-react";
import Link from "@/components/shared/LocaleLink";

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

const WORD: Record<string, string> = {
  ELIGIBLE: "مسموح", SUSPENDED: "موقوف", REVOKED: "اتلغى", EXPIRED: "انتهى",
  PENDING_PROVIDER: "مستني المزوّد", ACTIVE: "فعّال", REVOKE_PENDING: "بيتلغي", FAILED: "فشل",
  CREDENTIAL_ACTIVE: "التصريح اتفعّل", CREDENTIAL_UPDATED: "التصريح اتحدّث", CREDENTIAL_REVOKED: "التصريح اتلغى", CREDENTIAL_FAILED: "التصريح فشل",
  ENTRY_GRANTED: "دخل", ENTRY_DENIED: "اترفض دخوله", EXIT: "خرج", PROVIDER_ERROR: "خطأ من المزوّد",
  OVERRIDE_SUSPEND: "الأمن وقّف تصريح", OVERRIDE_REINSTATE: "الأمن رجّع تصريح", ESCALATION: "تصعيد",
  HOLDER: "صاحب الحجز", GUEST: "مرافق",
};
const w = (k: string) => WORD[k] ?? k;
const t = (iso: string) => new Intl.DateTimeFormat("ar-EG", { timeZone: "Africa/Cairo", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
const field = "w-full rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-sm";

export default function AccessDesk({ venueId, venueName }: { venueId: string; venueName: string }) {
  const base = `/api/venues/${venueId}/access`;
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
      const res = await fetch(`${base}${day ? `?day=${day}` : ""}`, { cache: "no-store" });
      if (!res.ok) {
        return { desk: null, day, failure: res.status === 401 ? "سجّل دخولك تاني." : res.status === 404 ? "مالكش صلاحية هنا." : "حصلت مشكلة." };
      }
      return { desk: (await res.json()) as Desk, failure: null, day };
    } catch {
      return { desk: null, failure: "تعذّر الاتصال.", day };
    }
  }, [base, day]);
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
      const res = await fetch(`${base}${path}`, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await res.json().catch(() => ({}));
      setMsg({ ok: res.ok, text: res.ok ? done : j.error ?? "حصلت مشكلة." });
      await load();
      return res.ok;
    } catch {
      setMsg({ ok: false, text: "تعذّر الاتصال، ومحصلش أي تغيير. جرّب تاني." });
      return false;
    } finally {
      setBusy(false);
    }
  }

  if (failure && !desk) return <main className="max-w-4xl mx-auto p-6 text-sm" dir="rtl">{failure}</main>;
  if (!desk) return <main className="max-w-4xl mx-auto p-6 text-sm" dir="rtl">بيحمّل…</main>;
  const s = desk.settings;
  const stale = deskDay !== day && !failure;

  return (
    <main className="max-w-5xl mx-auto p-4 sm:p-6 space-y-5" dir="rtl">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><ShieldCheck size={20} aria-hidden="true" /> دخول الزوار — {venueName}</h1>
          <p className="text-xs text-[var(--color-muted)]">
            الاسم والميعاد والبوابات وحالة التصريح بس. مفيش هنا تفاصيل الحجز ولا الفلوس ولا أرقام التليفونات.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" className={field} value={day} onChange={(e) => setDay(e.target.value)} aria-label="اليوم" />
          <button type="button" className="btn btn-outline btn-sm" onClick={() => void load()} aria-label="حدّث"><RefreshCw size={14} aria-hidden="true" /></button>
          {desk.authority !== "VENUE_SECURITY" && <Link href={`/venue-admin/${venueId}`} className="btn btn-outline btn-sm">لوحة المكان</Link>}
        </div>
      </header>

      {msg && <p className={`text-sm ${msg.ok ? "text-[var(--color-ok)]" : "text-[var(--color-danger)]"}`} role="status">{msg.text}</p>}
      {failure && <p className="text-sm text-[var(--color-danger)]" role="alert">مقدرناش نحدّث: {failure} اللي ظاهر ممكن يكون قديم.</p>}

      <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-white p-4 space-y-3">
        <h2 className="font-bold text-sm">الإعدادات</h2>
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
          <div><dt className="text-xs text-[var(--color-muted)]">تصاريح الزوار</dt><dd className="font-bold">{s.accessEnabled ? "شغّالة" : "مقفولة"}</dd></div>
          <div><dt className="text-xs text-[var(--color-muted)]">مزوّد الدخول</dt><dd>{s.provider ? s.provider.name : "مفيش"}</dd></div>
          <div>
            <dt className="text-xs text-[var(--color-muted)]">حالة المزوّد</dt>
            <dd>{!s.provider ? "—" : !s.provider.usable ? "مش متاح هنا" : s.provider.health ? `${s.provider.health.ok ? "شغّال" : "مش بيرد"} (${t(s.provider.health.at)})` : "لسه متكشفش عليه"}</dd>
          </div>
          <div><dt className="text-xs text-[var(--color-muted)]">التصعيد</dt><dd>{s.escalationContact ?? "—"}</dd></div>
        </dl>
        {s.provider?.kind === "SANDBOX" && (
          <p className="rounded-[var(--radius-sm)] bg-[var(--color-warn-soft)] px-3 py-2 text-xs font-bold text-[var(--color-star)]">
            المزوّد ده بيئة تجريبية: تصاريحه مش صالحة عند أي بوابة حقيقية.
          </p>
        )}
        {desk.can.enable && (confirmOff ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span>كل التصاريح الحالية هتتوقف لحد ما تتشغل تاني. متأكد؟</span>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              disabled={busy}
              onClick={() => {
                setConfirmOff(false);
                void send("", "PUT", { accessEnabled: false }, "اتقفلت — التصاريح الحالية اتوقفت مؤقتًا.");
              }}
            >
              أيوه، اقفلها
            </button>
            <button type="button" className="underline" onClick={() => setConfirmOff(false)}>لأ</button>
          </div>
        ) : (
          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={busy || (!s.accessEnabled && !s.provider?.usable)}
            onClick={() => (s.accessEnabled ? setConfirmOff(true) : void send("", "PUT", { accessEnabled: true }, "اشتغلت."))}
          >
            {s.accessEnabled ? "اقفل تصاريح الزوار" : "شغّل تصاريح الزوار"}
          </button>
        ))}
        {desk.can.provider && <ProviderForm desk={desk} busy={busy} send={send} />}
      </section>

      {desk.attention.length > 0 && (
        <section className="rounded-[var(--radius-lg)] border border-[var(--color-warn-line)] bg-[var(--color-warn-soft)] p-4 space-y-2">
          <h2 className="font-bold text-sm flex items-center gap-2"><AlertTriangle size={16} aria-hidden="true" /> محتاج حد يتابع</h2>
          <ul className="text-sm space-y-1">
            {desk.attention.map((a) => <li key={a.id}>{t(a.at)} — {w(a.kind)}{a.reason ? `: ${a.reason}` : ""}</li>)}
          </ul>
        </section>
      )}

      <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-white p-4 space-y-3">
        <h2 className="font-bold text-sm">التصاريح ({desk.rows.length})</h2>
        {stale && <p className="text-xs text-[var(--color-muted)]" role="status">بيحمّل اليوم اللي اخترته… اللي تحت لسه بتاع يوم تاني.</p>}
        {desk.rows.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">مفيش تصاريح في اليوم ده.</p>
        ) : (
          <div className={`overflow-x-auto ${stale ? "opacity-50" : ""}`}>
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-[var(--color-muted)] text-start">
                <th className="p-2 text-start">الزائر</th><th className="p-2 text-start">رايح لـ</th><th className="p-2 text-start">الوقت</th>
                <th className="p-2 text-start">الحق</th><th className="p-2 text-start">التصريح</th><th className="p-2 text-start">آخر حاجة</th>
                {desk.can.override && <th className="p-2" />}
              </tr></thead>
              <tbody>
                {desk.rows.map((r) => (
                  <tr key={r.entitlementId} className="border-t border-[var(--color-line)] align-top">
                    <td className="p-2">{r.visitorName}<div className="text-xs text-[var(--color-muted)]">{w(r.role)}</div></td>
                    <td className="p-2">{r.businessName}</td>
                    <td className="p-2" dir="ltr">{t(r.validFrom)}–{t(r.validUntil)}{r.entryUntil ? <div className="text-xs">≤ {t(r.entryUntil)}</div> : null}</td>
                    <td className="p-2">{w(r.status)}{r.reasonText ? <div className="text-xs text-[var(--color-muted)]">{r.reasonText}</div> : null}</td>
                    <td className="p-2">{r.pass ? w(r.pass.status) : "—"}{r.pass?.lastError ? <div className="text-xs text-[var(--color-danger)]">{r.pass.lastError}</div> : null}</td>
                    <td className="p-2">{r.lastEvent ? `${w(r.lastEvent.kind)} ${t(r.lastEvent.at)}${r.lastEvent.gate ? ` — ${r.lastEvent.gate}` : ""}` : "—"}</td>
                    {desk.can.override && (
                      <td className="p-2"><Override row={r} busy={busy} send={send} /></td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {desk.can.override && <EscalateForm busy={busy} send={send} />}

      <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-white p-4 space-y-2">
        <h2 className="font-bold text-sm">آخر الأحداث</h2>
        {desk.events.length === 0 ? <p className="text-sm text-[var(--color-muted)]">مفيش.</p> : (
          <ul className="text-sm space-y-1">
            {desk.events.map((e, i) => (
              <li key={i}>{t(e.at)} — {w(e.kind)}{e.gate ? ` (${e.gate})` : ""}{e.reason ? `: ${e.reason}` : ""}{e.byStaff ? " · بواسطة الأمن" : ""}</li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

type Send = (path: string, method: string, body: unknown, done: string) => Promise<boolean>;

function Override({ row, busy, send }: { row: Row; busy: boolean; send: Send }) {
  const [note, setNote] = useState("");
  const action = row.status === "ELIGIBLE" ? "suspend" : row.status === "SUSPENDED" && row.reason === "security-override" ? "reinstate" : null;
  if (!action) return null;
  return (
    <form
      className="flex gap-1"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await send(`/entitlements/${row.entitlementId}`, "POST", { action, note }, action === "suspend" ? "اتوقف." : "رجع.")) setNote("");
      }}
    >
      <input className={field} value={note} onChange={(e) => setNote(e.target.value)} placeholder="السبب" aria-label="السبب" required minLength={3} maxLength={300} />
      <button type="submit" className="btn btn-outline btn-sm" disabled={busy}>{action === "suspend" ? "وقّف" : "رجّع"}</button>
    </form>
  );
}

function EscalateForm({ busy, send }: { busy: boolean; send: Send }) {
  const [note, setNote] = useState("");
  return (
    <form
      className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-white p-4 space-y-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await send("/escalations", "POST", { note }, "اتسجّل التصعيد.")) setNote("");
      }}
    >
      <h2 className="font-bold text-sm">سجّل تصعيد</h2>
      <textarea className={field} value={note} onChange={(e) => setNote(e.target.value)} placeholder="اللي حصل" aria-label="اللي حصل" required minLength={3} maxLength={300} />
      <button type="submit" className="btn btn-outline btn-sm" disabled={busy}>سجّل</button>
    </form>
  );
}

function ProviderForm({ desk, busy, send }: { desk: Desk; busy: boolean; send: Send }) {
  const [slug, setSlug] = useState(desk.settings.provider?.slug ?? "");
  const [siteRef, setSiteRef] = useState(desk.settings.siteRef ?? "");
  return (
    <form
      className="grid gap-2 sm:grid-cols-3 border-t border-[var(--color-line)] pt-3"
      onSubmit={(e) => {
        e.preventDefault();
        void send("", "PUT", { providerSlug: slug || null, siteRef: siteRef || null }, "اتحفظ المزوّد.");
      }}
    >
      <select className={field} value={slug} onChange={(e) => setSlug(e.target.value)} aria-label="مزوّد الدخول">
        <option value="">من غير مزوّد</option>
        {desk.providers.map((p) => (
          <option key={p.slug} value={p.slug} disabled={!p.usable}>{p.name}{p.usable ? "" : " (مش متاح هنا)"}</option>
        ))}
      </select>
      <input className={field} value={siteRef} onChange={(e) => setSiteRef(e.target.value)} placeholder="كود المكان عند المزوّد" aria-label="كود المكان عند المزوّد" dir="ltr" />
      <button type="submit" className="btn btn-outline btn-sm" disabled={busy}>احفظ (إدارة موعد بس)</button>
    </form>
  );
}
