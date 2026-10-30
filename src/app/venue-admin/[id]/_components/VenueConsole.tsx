"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Trash2 } from "lucide-react";
import Link from "@/components/shared/LocaleLink";
import { useLanguage } from "@/contexts/LanguageContext";

/* The shapes the console reads from GET /api/venues/:id. */
interface Zone { id: string; kind: string; nameAr: string; nameEn: string | null; level: number | null; sortOrder: number }
interface Gate { id: string; nameAr: string; nameEn: string | null; kind: string; code: string | null; isActive: boolean; venueId: string | null; compoundId: string | null }
interface Hours { dayOfWeek: number; openTime: string; closeTime: string; isClosed: boolean }
interface Policy {
  visitorEligibility: string; accessBeforeMinutes: number; accessAfterMinutes: number; maxGuestsPerBooking: number;
  reentryAllowed: boolean; allowedGateIds: string[]; accessInstructionsAr: string | null; accessInstructionsEn: string | null;
}
interface Exception { id: string; kind: string; startsOn: string; endsOn: string; openTime: string | null; closeTime: string | null; noteAr: string | null }
interface Venue {
  id: string; slug: string; status: string; isPublished: boolean; kind: string;
  nameAr: string; nameEn: string | null; descriptionAr: string | null; descriptionEn: string | null;
  address: string | null; phone: string | null; website: string | null; latitude: number | null; longitude: number | null;
  city: { nameAr: string; nameEn: string }; compound: { id: string; nameAr: string } | null;
  zones: Zone[]; gates: Gate[]; hours: Hours[]; policy: Policy | null; exceptions: Exception[];
}
interface Membership {
  id: string; status: string; unit: string | null; requestedAt: string; decisionNote: string | null;
  zone: { id: string; nameAr: string } | null;
  branch: { id: string; nameAr: string; address: string | null } | null;
  business: { slug: string; nameAr: string; isPublished: boolean; category: { nameAr: string; nameEn: string } | null };
}
interface Metrics { windowDays: number; tenants: { approved: number; requested: number }; bookings: { total: number; byStatus: Record<string, number> } }
interface Attention { kind: string; severity: number; count: number; ar: string; en: string; names?: string[] }

/* Words for the values the console shows, so neither language sees an enum. */
const LABELS: Record<string, [string, string]> = {
  DRAFT: ["مسودة", "Draft"], ACTIVE: ["مفعّل", "Active"], SUSPENDED: ["موقوف", "Suspended"],
  FLOOR: ["دور", "Floor"], ZONE: ["منطقة", "Zone"], WING: ["جناح", "Wing"],
  VEHICLE: ["سيارات", "Vehicles"], PEDESTRIAN: ["مشاة", "Pedestrians"], MIXED: ["سيارات ومشاة", "Mixed"],
  CLOSED: ["مقفول", "Closed"], SPECIAL_HOURS: ["مواعيد خاصة", "Special hours"],
  ACCESS_SUSPENDED: ["دخول الزوار موقوف", "Visitor access suspended"], BOOKINGS_PAUSED: ["الحجوزات موقوفة", "Bookings paused"],
  PLATFORM: ["إدارة موعد", "Maw3ed administrator"], ORGANIZATION_ADMIN: ["مدير الجهة", "Organisation admin"],
  COMPOUND_ADMIN: ["مدير الكمبوند", "Compound admin"], VENUE_MANAGER: ["مدير المكان", "Venue manager"],
};

const DAYS_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const DAYS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const field = "w-full rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-sm";

async function api(path: string, method = "GET", body?: unknown): Promise<{ ok: boolean; json: Record<string, unknown> }> {
  const res = await fetch(path, {
    method,
    cache: "no-store",
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, json: { ...json, __status: res.status } };
}

export default function VenueConsole({ venueId }: { venueId: string }) {
  const { lang } = useLanguage();
  const en = lang === "en";
  const t = (ar: string, e: string) => (en ? e : ar);
  const base = `/api/venues/${venueId}`;

  const [venue, setVenue] = useState<Venue | null>(null);
  const [compoundGates, setCompoundGates] = useState<Gate[]>([]);
  const [can, setCan] = useState<{ compoundGates: boolean; publish: boolean }>({ compoundGates: false, publish: false });
  const [authority, setAuthority] = useState("");
  const [members, setMembers] = useState<Membership[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [attention, setAttention] = useState<Attention[]>([]);
  // Why the console cannot show anything: the session ran out, the role
  // was taken away, or the server failed. Never an endless "Loading".
  const [failure, setFailure] = useState<"signin" | "gone" | "error" | null>(null);

  const fetchAll = useCallback(
    () => Promise.all([api(base), api(`${base}/memberships`), api(`${base}/metrics`)]).catch(() => null),
    [base],
  );

  const apply = useCallback((r: Awaited<ReturnType<typeof fetchAll>>) => {
    if (!r) return setFailure("error");
    const [v, m, k] = r;
    if (!v.ok) {
      const status = Number(v.json.__status ?? 0);
      return setFailure(status === 401 ? "signin" : status === 404 ? "gone" : "error");
    }
    setFailure(null);
    setVenue(v.json.venue as Venue);
    setCompoundGates((v.json.compoundGates as Gate[]) ?? []);
    setAttention((v.json.attention as Attention[]) ?? []);
    setCan(v.json.can as { compoundGates: boolean; publish: boolean });
    setAuthority(String(v.json.authority ?? ""));
    if (m.ok) setMembers(m.json.memberships as Membership[]);
    if (k.ok) setMetrics(k.json as unknown as Metrics);
  }, []);

  const load = useCallback(async () => apply(await fetchAll()), [apply, fetchAll]);

  useEffect(() => {
    let live = true;
    fetchAll().then((r) => {
      if (live) apply(r);
    });
    return () => {
      live = false;
    };
  }, [fetchAll, apply]);

  async function act(path: string, method: string, body?: unknown, done?: string) {
    setMsg(null);
    const r = await api(path, method, body);
    setMsg({ ok: r.ok, text: r.ok ? done ?? t("اتحفظ.", "Saved.") : String(r.json.error ?? t("حصلت مشكلة.", "Something went wrong.")) });
    // A refusal because the session ended or access was taken away is
    // not a form error: reload, which shows why the console is closed.
    const status = Number(r.json.__status ?? 0);
    if (r.ok || status === 401 || status === 404) await load();
    return r.ok;
  }

  if (failure) {
    return (
      <main id="main" className="mx-auto max-w-xl space-y-3 p-8 text-sm" dir={en ? "ltr" : "rtl"} role="alert">
        <p className="m-0 font-bold">
          {failure === "signin"
            ? t("الجلسة خلصت. سجّل دخولك تاني.", "Your session has ended. Please sign in again.")
            : failure === "gone"
              ? t("مبقاش عندك صلاحية على المكان ده.", "You no longer have access to this venue.")
              : t("مقدرناش نحمّل المكان. جرّب تاني بعد شوية.", "Could not load the venue. Try again shortly.")}
        </p>
        {failure === "signin" ? (
          <Link href={`/login?next=/venue-admin/${venueId}`} className="btn btn-primary btn-sm">{t("تسجيل الدخول", "Sign in")}</Link>
        ) : failure === "gone" ? (
          <Link href="/venue-admin" className="btn btn-outline btn-sm">{t("الأماكن اللي بتديرها", "Venues you manage")}</Link>
        ) : (
          <button type="button" className="btn btn-outline btn-sm" onClick={() => void load()}>{t("جرّب تاني", "Try again")}</button>
        )}
      </main>
    );
  }
  if (!venue) return <main className="p-8 text-sm text-[var(--color-subtle)]" aria-busy="true">{t("بنحمّل…", "Loading…")}</main>;
  const nm = (x: { nameAr: string; nameEn?: string | null }) => (en ? x.nameEn || x.nameAr : x.nameAr);
  const lab = (v: string) => (LABELS[v] ? (en ? LABELS[v][1] : LABELS[v][0]) : v);
  const allGates = [...venue.gates, ...compoundGates];

  return (
    <main id="main" className="mx-auto max-w-5xl space-y-6 p-5 md:p-8" dir={en ? "ltr" : "rtl"}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <Link href="/venue-admin" className="text-xs text-[var(--color-jade)] underline">{t("كل الأماكن", "All venues")}</Link>
          <h1 className="m-0 text-2xl font-black">{nm(venue)}</h1>
          <p className="m-0 text-xs text-[var(--color-subtle)]">
            {nm(venue.city)}{venue.compound ? ` · ${venue.compound.nameAr}` : ""} · {lab(venue.status)} ·{" "}
            {venue.isPublished ? t("منشور", "public") : t("مش منشور — النشر من إدارة موعد", "not public — Maw3ed's administrators publish venues")} · {lab(authority)}
          </p>
        </div>
        {venue.isPublished && venue.status === "ACTIVE" && (
          <Link href={`/venues/${venue.slug}`} target="_blank" className="btn btn-outline btn-sm gap-1.5">
            <ExternalLink size={14} aria-hidden="true" />
            {t("الصفحة العامة", "Public page")}
          </Link>
        )}
      </header>

      <p role="status" className={`m-0 min-h-5 text-sm ${msg?.ok ? "text-[var(--color-ok)]" : "text-[var(--color-danger)]"}`}>{msg?.text}</p>

      <section aria-labelledby="att-h" className="card space-y-2 p-5">
        <h2 id="att-h" className="m-0 text-base font-extrabold">{t("محتاج انتباهك", "Needs your attention")}</h2>
        {attention.length === 0 ? (
          <p className="m-0 text-sm text-[var(--color-ok)]">{t("مفيش حاجة مستنياك.", "Nothing needs your attention.")}</p>
        ) : (
          <ul className="m-0 list-none space-y-1.5 p-0 text-sm">
            {attention.map((a) => (
              <li key={a.kind} className={a.severity >= 2 ? "text-[var(--color-warn)]" : ""}>
                <span className="font-bold">{en ? a.en : a.ar}</span>
                {a.names?.length ? <span className="text-xs text-[var(--color-subtle)]"> — {a.names.slice(0, 5).join("، ")}{a.names.length > 5 ? "…" : ""}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {metrics && (
        <section aria-labelledby="m-h" className="card space-y-2 p-5">
          <h2 id="m-h" className="m-0 text-base font-extrabold">{t(`آخر ${metrics.windowDays} يوم`, `Last ${metrics.windowDays} days`)}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile label={t("أماكن معروضة", "Listed businesses")} value={metrics.tenants.approved} />
            <Tile label={t("طلبات مستنية", "Pending requests")} value={metrics.tenants.requested} />
            <Tile label={t("حجوزات", "Bookings")} value={metrics.bookings.total} />
            <Tile label={t("حجوزات خلصت", "Completed")} value={metrics.bookings.byStatus.COMPLETED ?? 0} />
          </div>
          <p className="m-0 text-xs text-[var(--color-subtle)]">
            {t("أرقام بس. بيانات العملاء وحجوزاتهم ومدفوعاتهم بتفضل عند كل نشاط.", "Counts only. Customers, their bookings and payments stay with each business.")}
          </p>
        </section>
      )}

      <Memberships members={members} zones={venue.zones} t={t} onAct={(id, body, done) => act(`${base}/memberships/${id}`, "PATCH", body, done)} />

      <InfoForm venue={venue} t={t} onSave={(info) => act(base, "PATCH", { info })} />

      <HoursForm hours={venue.hours} en={en} t={t} onSave={(hours) => act(base, "PATCH", { hours })} />

      <section aria-labelledby="z-h" className="card space-y-3 p-5">
        <h2 id="z-h" className="m-0 text-base font-extrabold">{t("الأدوار والمناطق", "Floors and zones")}</h2>
        <ul className="m-0 list-none space-y-1 p-0 text-sm">
          {venue.zones.map((z) => (
            <li key={z.id} className="flex items-center justify-between gap-2">
              <span>{nm(z)} <span className="text-xs text-[var(--color-subtle)]">{lab(z.kind)}{z.level != null ? ` · ${z.level}` : ""}</span></span>
              <button type="button" className="btn btn-ghost btn-sm" aria-label={t("حذف", "Delete")} onClick={() => act(`${base}/zones/${z.id}`, "DELETE")}>
                <Trash2 size={14} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
        <ZoneForm t={t} onAdd={(z) => act(`${base}/zones`, "POST", z, t("اتضاف.", "Added."))} />
      </section>

      <section aria-labelledby="g-h" className="card space-y-3 p-5">
        <h2 id="g-h" className="m-0 text-base font-extrabold">{t("البوابات (معلومات بس)", "Gates (information only)")}</h2>
        <p className="m-0 text-xs text-[var(--color-subtle)]">
          {t("موعد مش بيفتح بوابات. دي معلومات بتظهر للزوار وتتقري لاحقًا من خدمة دخول منفصلة لو الجهة المشغلة وفّرت ربط.", "Maw3ed does not open gates. These are shown to visitors and can later be read by a separate access service if the operator provides an integration.")}
        </p>
        <ul className="m-0 list-none space-y-1 p-0 text-sm">
          {allGates.map((g) => (
            <li key={g.id} className="flex items-center justify-between gap-2">
              <span>
                {nm(g)} <span className="text-xs text-[var(--color-subtle)]">{lab(g.kind)}{g.code ? ` · ${g.code}` : ""}{g.compoundId ? t(" · بوابة الكمبوند", " · compound gate") : ""}{g.isActive ? "" : t(" · متوقفة", " · inactive")}</span>
              </span>
              {(g.venueId || can.compoundGates) && (
                <span className="flex items-center gap-1">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => act(`${base}/gates/${g.id}`, "PATCH", { isActive: !g.isActive })}>
                    {g.isActive ? t("وقّفها", "Turn off") : t("شغّلها", "Turn on")}
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" aria-label={t("حذف", "Delete")} onClick={() => act(`${base}/gates/${g.id}`, "DELETE")}>
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
        <GateForm t={t} canCompound={can.compoundGates} onAdd={(g) => act(`${base}/gates`, "POST", g, t("اتضافت.", "Added."))} />
      </section>

      <PolicyForm policy={venue.policy} gates={allGates} t={t} nm={nm} onSave={(p) => act(`${base}/policy`, "PUT", p)} />

      <section aria-labelledby="e-h" className="card space-y-3 p-5">
        <h2 id="e-h" className="m-0 text-base font-extrabold">{t("استثناءات وتنبيهات", "Exceptions and notices")}</h2>
        <ul className="m-0 list-none space-y-1 p-0 text-sm">
          {venue.exceptions.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-2">
              <span dir="ltr" className="num">{e.startsOn.slice(0, 10)} → {e.endsOn.slice(0, 10)}</span>
              <span className="flex-1 px-2">{lab(e.kind)}{e.noteAr ? ` — ${e.noteAr}` : ""}</span>
              <button type="button" className="btn btn-ghost btn-sm" aria-label={t("حذف", "Delete")} onClick={() => act(`${base}/exceptions/${e.id}`, "DELETE")}>
                <Trash2 size={14} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
        <ExceptionForm t={t} onAdd={(e) => act(`${base}/exceptions`, "POST", e, t("اتضاف.", "Added."))} />
      </section>
    </main>
  );
}

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] p-3">
      <p className="m-0 text-xs text-[var(--color-subtle)]">{label}</p>
      <p className="num m-0 text-xl font-bold">{value}</p>
    </div>
  );
}

type T = (ar: string, en: string) => string;

function Memberships({ members, zones, t, onAct }: { members: Membership[]; zones: Zone[]; t: T; onAct: (id: string, body: unknown, done?: string) => Promise<boolean> }) {
  const label: Record<string, string> = {
    REQUESTED: t("طلب جديد", "Requested"), APPROVED: t("معروض", "Listed"), REJECTED: t("مرفوض", "Rejected"), REMOVED: t("اتشال", "Removed"),
  };
  return (
    <section aria-labelledby="mem-h" className="card space-y-3 p-5">
      <h2 id="mem-h" className="m-0 text-base font-extrabold">{t("الأنشطة والطلبات", "Businesses and requests")}</h2>
      {members.length === 0 ? (
        <p className="m-0 text-sm text-[var(--color-subtle)]">{t("لسه مفيش طلبات. صاحب النشاط بيطلب من لوحة التحكم بتاعته.", "No requests yet. A business owner asks from their own dashboard.")}</p>
      ) : (
        <ul className="m-0 list-none divide-y divide-[var(--color-line)] p-0">
          {members.map((m) => (
            <li key={m.id} className="space-y-2 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="m-0 text-sm">
                  <span className="font-bold">{m.business.nameAr}</span>
                  {m.branch ? ` · ${m.branch.nameAr}` : ""}
                  {m.business.category ? <span className="text-xs text-[var(--color-subtle)]"> · {m.business.category.nameAr}</span> : null}
                  {!m.business.isPublished && <span className="text-xs text-[var(--color-warn)]"> · {t("صفحته مش منشورة — مش هيظهر لحد ما تتنشر", "its page is not public — not shown until it is")}</span>}
                </p>
                <span className="badge">{label[m.status] ?? m.status}</span>
              </div>
              {(m.status === "REQUESTED" || m.status === "APPROVED") && (
                <MemberActions m={m} zones={zones} t={t} onAct={onAct} />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function MemberActions({ m, zones, t, onAct }: { m: Membership; zones: Zone[]; t: T; onAct: (id: string, body: unknown, done?: string) => Promise<boolean> }) {
  const [zoneId, setZoneId] = useState(m.zone?.id ?? "");
  const [unit, setUnit] = useState(m.unit ?? "");
  const placement = { zoneId: zoneId || null, unit: unit.trim() || null };
  return (
    <div className="flex flex-wrap items-end gap-2 text-sm">
      {zones.length > 0 && (
        <label className="space-y-1">
          <span className="block text-xs">{t("الدور", "Floor")}</span>
          <select className={field} value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
            <option value="">—</option>
            {zones.map((z) => <option key={z.id} value={z.id}>{z.nameAr}</option>)}
          </select>
        </label>
      )}
      <label className="space-y-1">
        <span className="block text-xs">{t("رقم الوحدة", "Unit")}</span>
        <input className={field} value={unit} onChange={(e) => setUnit(e.target.value)} maxLength={40} />
      </label>
      {m.status === "REQUESTED" ? (
        <>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => onAct(m.id, { decision: "approve", ...placement }, t("اتقبل.", "Approved."))}>{t("قبول", "Approve")}</button>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => onAct(m.id, { decision: "reject" }, t("اترفض.", "Rejected."))}>{t("رفض", "Reject")}</button>
        </>
      ) : (
        <>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => onAct(m.id, { decision: "place", ...placement })}>{t("حفظ المكان", "Save placement")}</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onAct(m.id, { decision: "remove" }, t("اتشال من المكان.", "Removed."))}>{t("شيل من المكان", "Remove")}</button>
        </>
      )}
    </div>
  );
}

function InfoForm({ venue, t, onSave }: { venue: Venue; t: T; onSave: (info: Record<string, unknown>) => Promise<boolean> }) {
  const [v, setV] = useState({
    nameAr: venue.nameAr, nameEn: venue.nameEn ?? "", descriptionAr: venue.descriptionAr ?? "", descriptionEn: venue.descriptionEn ?? "",
    address: venue.address ?? "", phone: venue.phone ?? "", website: venue.website ?? "",
    latitude: venue.latitude?.toString() ?? "", longitude: venue.longitude?.toString() ?? "",
  });
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV((p) => ({ ...p, [k]: e.target.value }));
  return (
    <form
      className="card space-y-3 p-5"
      aria-labelledby="info-h"
      onSubmit={(e) => {
        e.preventDefault();
        void onSave({
          nameAr: v.nameAr, nameEn: v.nameEn, descriptionAr: v.descriptionAr, descriptionEn: v.descriptionEn,
          address: v.address, phone: v.phone, website: v.website,
          latitude: v.latitude ? Number(v.latitude) : null, longitude: v.longitude ? Number(v.longitude) : null,
        });
      }}
    >
      <h2 id="info-h" className="m-0 text-base font-extrabold">{t("بيانات المكان", "Venue details")}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <L label={t("الاسم بالعربي", "Name (Arabic)")}><input className={field} value={v.nameAr} onChange={set("nameAr")} required /></L>
        <L label={t("الاسم بالإنجليزي", "Name (English)")}><input className={field} value={v.nameEn} onChange={set("nameEn")} dir="ltr" /></L>
        <L label={t("الوصف بالعربي", "Description (Arabic)")}><textarea className={field} rows={3} value={v.descriptionAr} onChange={set("descriptionAr")} /></L>
        <L label={t("الوصف بالإنجليزي", "Description (English)")}><textarea className={field} rows={3} value={v.descriptionEn} onChange={set("descriptionEn")} dir="ltr" /></L>
        <L label={t("العنوان", "Address")}><input className={field} value={v.address} onChange={set("address")} /></L>
        <L label={t("التليفون", "Phone")}><input className={field} value={v.phone} onChange={set("phone")} dir="ltr" /></L>
        <L label={t("الموقع الرسمي", "Website")}><input className={field} value={v.website} onChange={set("website")} dir="ltr" type="url" /></L>
        <div className="grid grid-cols-2 gap-2">
          <L label={t("خط العرض", "Latitude")}><input className={field} value={v.latitude} onChange={set("latitude")} dir="ltr" inputMode="decimal" /></L>
          <L label={t("خط الطول", "Longitude")}><input className={field} value={v.longitude} onChange={set("longitude")} dir="ltr" inputMode="decimal" /></L>
        </div>
      </div>
      <button type="submit" className="btn btn-primary">{t("احفظ", "Save")}</button>
    </form>
  );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="font-bold">{label}</span>
      {children}
    </label>
  );
}

function HoursForm({ hours, en, t, onSave }: { hours: Hours[]; en: boolean; t: T; onSave: (h: Hours[]) => Promise<boolean> }) {
  const [rows, setRows] = useState<Hours[]>(() =>
    [0, 1, 2, 3, 4, 5, 6].map((d) => hours.find((h) => h.dayOfWeek === d) ?? { dayOfWeek: d, openTime: "10:00", closeTime: "22:00", isClosed: false }),
  );
  const upd = (d: number, patch: Partial<Hours>) => setRows((r) => r.map((x) => (x.dayOfWeek === d ? { ...x, ...patch } : x)));
  return (
    <form className="card space-y-3 p-5" aria-labelledby="h-h" onSubmit={(e) => { e.preventDefault(); void onSave(rows); }}>
      <h2 id="h-h" className="m-0 text-base font-extrabold">{t("مواعيد المكان", "Venue opening hours")}</h2>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.dayOfWeek} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="w-20">{(en ? DAYS_EN : DAYS_AR)[r.dayOfWeek]}</span>
            <input type="time" className={`${field} w-32`} value={r.openTime} disabled={r.isClosed} onChange={(e) => upd(r.dayOfWeek, { openTime: e.target.value })} dir="ltr" aria-label={t("يفتح", "Opens")} />
            <input type="time" className={`${field} w-32`} value={r.closeTime} disabled={r.isClosed} onChange={(e) => upd(r.dayOfWeek, { closeTime: e.target.value })} dir="ltr" aria-label={t("يقفل", "Closes")} />
            <label className="flex items-center gap-1"><input type="checkbox" checked={r.isClosed} onChange={(e) => upd(r.dayOfWeek, { isClosed: e.target.checked })} />{t("مقفول", "Closed")}</label>
          </div>
        ))}
      </div>
      <button type="submit" className="btn btn-primary">{t("احفظ المواعيد", "Save hours")}</button>
    </form>
  );
}

function ZoneForm({ t, onAdd }: { t: T; onAdd: (z: unknown) => Promise<boolean> }) {
  const [z, setZ] = useState({ kind: "FLOOR", nameAr: "", nameEn: "", level: "" });
  return (
    <form
      className="flex flex-wrap items-end gap-2 text-sm"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await onAdd({ kind: z.kind, nameAr: z.nameAr, nameEn: z.nameEn, level: z.level === "" ? null : Number(z.level) })) setZ({ kind: "FLOOR", nameAr: "", nameEn: "", level: "" });
      }}
    >
      <select className={`${field} w-28`} value={z.kind} onChange={(e) => setZ({ ...z, kind: e.target.value })} aria-label={t("النوع", "Kind")}>
        <option value="FLOOR">{t("دور", "Floor")}</option><option value="ZONE">{t("منطقة", "Zone")}</option><option value="WING">{t("جناح", "Wing")}</option>
      </select>
      <input className={`${field} w-40`} placeholder={t("الاسم بالعربي", "Arabic name")} value={z.nameAr} onChange={(e) => setZ({ ...z, nameAr: e.target.value })} required />
      <input className={`${field} w-40`} placeholder={t("الاسم بالإنجليزي", "English name")} value={z.nameEn} onChange={(e) => setZ({ ...z, nameEn: e.target.value })} dir="ltr" />
      <input className={`${field} w-24`} placeholder={t("رقم الدور", "Level")} value={z.level} onChange={(e) => setZ({ ...z, level: e.target.value })} inputMode="numeric" dir="ltr" />
      <button type="submit" className="btn btn-outline btn-sm">{t("أضف", "Add")}</button>
    </form>
  );
}

function GateForm({ t, canCompound, onAdd }: { t: T; canCompound: boolean; onAdd: (g: unknown) => Promise<boolean> }) {
  const empty = { nameAr: "", nameEn: "", kind: "MIXED", code: "", scope: "venue" };
  const [g, setG] = useState(empty);
  return (
    <form className="flex flex-wrap items-end gap-2 text-sm" onSubmit={async (e) => { e.preventDefault(); if (await onAdd(g)) setG(empty); }}>
      <input className={`${field} w-40`} placeholder={t("اسم البوابة", "Gate name")} value={g.nameAr} onChange={(e) => setG({ ...g, nameAr: e.target.value })} required />
      <input className={`${field} w-40`} placeholder={t("بالإنجليزي", "English name")} value={g.nameEn} onChange={(e) => setG({ ...g, nameEn: e.target.value })} dir="ltr" />
      <select className={`${field} w-36`} value={g.kind} onChange={(e) => setG({ ...g, kind: e.target.value })} aria-label={t("النوع", "Kind")}>
        <option value="MIXED">{t("سيارات ومشاة", "Mixed")}</option><option value="VEHICLE">{t("سيارات", "Vehicles")}</option><option value="PEDESTRIAN">{t("مشاة", "Pedestrians")}</option>
      </select>
      <input className={`${field} w-32`} placeholder={t("كود الجهة", "Operator code")} value={g.code} onChange={(e) => setG({ ...g, code: e.target.value })} dir="ltr" />
      {canCompound && (
        <select className={`${field} w-36`} value={g.scope} onChange={(e) => setG({ ...g, scope: e.target.value })} aria-label={t("تبع", "Belongs to")}>
          <option value="venue">{t("المكان", "This venue")}</option><option value="compound">{t("الكمبوند", "The compound")}</option>
        </select>
      )}
      <button type="submit" className="btn btn-outline btn-sm">{t("أضف", "Add")}</button>
    </form>
  );
}

function PolicyForm({ policy, gates, t, nm, onSave }: { policy: Policy | null; gates: Gate[]; t: T; nm: (x: { nameAr: string; nameEn?: string | null }) => string; onSave: (p: unknown) => Promise<boolean> }) {
  const [p, setP] = useState<Policy>(
    policy ?? { visitorEligibility: "OPEN", accessBeforeMinutes: 30, accessAfterMinutes: 30, maxGuestsPerBooking: 0, reentryAllowed: false, allowedGateIds: [], accessInstructionsAr: "", accessInstructionsEn: "" },
  );
  const num = (k: "accessBeforeMinutes" | "accessAfterMinutes" | "maxGuestsPerBooking") => (e: React.ChangeEvent<HTMLInputElement>) =>
    setP({ ...p, [k]: Math.max(0, Math.trunc(Number(e.target.value) || 0)) });
  return (
    <form className="card space-y-3 p-5" aria-labelledby="p-h" onSubmit={(e) => { e.preventDefault(); void onSave({ ...p, accessInstructionsAr: p.accessInstructionsAr ?? "", accessInstructionsEn: p.accessInstructionsEn ?? "" }); }}>
      <h2 id="p-h" className="m-0 text-base font-extrabold">{t("سياسة دخول الزوار", "Visitor access policy")}</h2>
      <p className="m-0 text-xs text-[var(--color-subtle)]">{t("إعدادات ومعلومات بس — مفيش حاجة هنا بتسمح لحد يدخل.", "Settings and published information only — nothing here lets anyone in.")}</p>
      <L label={t("مين يقدر يدخل", "Who may enter")}>
        <select className={field} value={p.visitorEligibility} onChange={(e) => setP({ ...p, visitorEligibility: e.target.value })}>
          <option value="OPEN">{t("أي حد في مواعيد الفتح", "Anyone during opening hours")}</option>
          <option value="BOOKING_REQUIRED">{t("بحجز في مكان جوه", "With a booking inside")}</option>
          <option value="OPERATOR_MANAGED">{t("بتنظمه الإدارة", "Arranged by the operator")}</option>
          <option value="CLOSED_TO_VISITORS">{t("مقفول للزوار", "Closed to visitors")}</option>
        </select>
      </L>
      <div className="grid gap-3 sm:grid-cols-3">
        <L label={t("يوصل قبل الميعاد بـ (دقيقة)", "Arrive up to (min before)")}><input type="number" min={0} max={720} className={field} value={p.accessBeforeMinutes} onChange={num("accessBeforeMinutes")} /></L>
        <L label={t("يفضل بعد الميعاد لـ (دقيقة)", "Stay up to (min after)")}><input type="number" min={0} max={720} className={field} value={p.accessAfterMinutes} onChange={num("accessAfterMinutes")} /></L>
        <L label={t("أقصى عدد مرافقين", "Max guests per booking")}><input type="number" min={0} max={50} className={field} value={p.maxGuestsPerBooking} onChange={num("maxGuestsPerBooking")} /></L>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={p.reentryAllowed} onChange={(e) => setP({ ...p, reentryAllowed: e.target.checked })} />{t("مسموح يخرج ويرجع", "Re-entry allowed")}</label>
      {gates.length > 0 && (
        <fieldset className="space-y-1 text-sm">
          <legend className="font-bold">{t("بوابات الدخول المسموحة (لو مفيش اختيار: الكل)", "Allowed entry points (none ticked: all)")}</legend>
          {gates.map((g) => (
            <label key={g.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={p.allowedGateIds.includes(g.id)}
                onChange={(e) => setP({ ...p, allowedGateIds: e.target.checked ? [...p.allowedGateIds, g.id] : p.allowedGateIds.filter((x) => x !== g.id) })}
              />
              {nm(g)}
            </label>
          ))}
        </fieldset>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <L label={t("تعليمات الدخول بالعربي", "Access instructions (Arabic)")}><textarea className={field} rows={4} value={p.accessInstructionsAr ?? ""} onChange={(e) => setP({ ...p, accessInstructionsAr: e.target.value })} /></L>
        <L label={t("تعليمات الدخول بالإنجليزي", "Access instructions (English)")}><textarea className={field} rows={4} value={p.accessInstructionsEn ?? ""} onChange={(e) => setP({ ...p, accessInstructionsEn: e.target.value })} dir="ltr" /></L>
      </div>
      <button type="submit" className="btn btn-primary">{t("احفظ السياسة", "Save policy")}</button>
    </form>
  );
}

function ExceptionForm({ t, onAdd }: { t: T; onAdd: (e: unknown) => Promise<boolean> }) {
  const empty = { kind: "CLOSED", startsOn: "", endsOn: "", openTime: "", closeTime: "", noteAr: "", noteEn: "" };
  const [x, setX] = useState(empty);
  return (
    <form
      className="flex flex-wrap items-end gap-2 text-sm"
      onSubmit={async (e) => {
        e.preventDefault();
        const ok = await onAdd({ ...x, endsOn: x.endsOn || x.startsOn, openTime: x.openTime || null, closeTime: x.closeTime || null });
        if (ok) setX(empty);
      }}
    >
      <select className={`${field} w-40`} value={x.kind} onChange={(e) => setX({ ...x, kind: e.target.value })} aria-label={t("النوع", "Kind")}>
        <option value="CLOSED">{t("مقفول", "Closed")}</option>
        <option value="SPECIAL_HOURS">{t("مواعيد خاصة", "Special hours")}</option>
        <option value="ACCESS_SUSPENDED">{t("دخول الزوار موقوف", "Visitor access suspended")}</option>
        <option value="BOOKINGS_PAUSED">{t("الحجوزات موقوفة", "Bookings paused")}</option>
      </select>
      <input type="date" className={`${field} w-40`} value={x.startsOn} onChange={(e) => setX({ ...x, startsOn: e.target.value })} required aria-label={t("من", "From")} dir="ltr" />
      <input type="date" className={`${field} w-40`} value={x.endsOn} onChange={(e) => setX({ ...x, endsOn: e.target.value })} aria-label={t("لحد", "Until")} dir="ltr" />
      {x.kind === "SPECIAL_HOURS" && (
        <>
          <input type="time" className={`${field} w-28`} value={x.openTime} onChange={(e) => setX({ ...x, openTime: e.target.value })} aria-label={t("يفتح", "Opens")} dir="ltr" />
          <input type="time" className={`${field} w-28`} value={x.closeTime} onChange={(e) => setX({ ...x, closeTime: e.target.value })} aria-label={t("يقفل", "Closes")} dir="ltr" />
        </>
      )}
      <input className={`${field} w-56`} placeholder={t("ملاحظة للزوار", "Note for visitors")} value={x.noteAr} onChange={(e) => setX({ ...x, noteAr: e.target.value })} />
      <button type="submit" className="btn btn-outline btn-sm">{t("أضف", "Add")}</button>
    </form>
  );
}
